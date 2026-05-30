//! Chat's `PolicyStore` impl — feeds the engine's `check_access`
//! and `list_visible_resource_ids` from chat's Postgres.
//!
//! Ported from `filez-server`'s `FilezPolicyStore` with the
//! UserGroup-subject path stripped (chat has no user_groups
//! schema yet; Round 4 adds it). The duplication is tracked in
//! `.plans/chat-service/IDEA.md` §"Engine duplication is itself a
//! finding" — the moment a third consumer arrives is when we
//! extract `EngineBackedPolicyStore` into `mows-auth-core`.

use std::collections::HashMap;

use async_trait::async_trait;
use diesel::{
    pg::sql_types,
    prelude::*,
    QueryableByName,
};
use diesel_async::RunQueryDsl;
use mows_auth_core::{
    types::Effect, AppView, AuthError, PolicyStore, PolicyView, ResourceAuthInfo, Subject,
};
use uuid::Uuid;

use crate::{
    database::Database,
    models::access_policies::{
        AccessPolicy, AccessPolicyAction, AccessPolicyResourceType,
    },
    models::apps::MowsAppId,
    schema,
};

#[derive(Debug)]
pub struct ChatPolicyStore<'a> {
    database: &'a Database,
}

impl<'a> ChatPolicyStore<'a> {
    pub fn new(database: &'a Database) -> Self {
        Self { database }
    }
}

#[derive(QueryableByName, Debug, Clone)]
struct OwnerRow {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    owner_id: Uuid,
}

/// Reverse of `AccessPolicyAction as u32`. The discriminants are
/// SMALLINT-backed wire-stable values; this is the inverse of the
/// `as u32` cast every handler does on the way INTO the engine.
fn action_from_u32(v: u32) -> Option<AccessPolicyAction> {
    match v {
        100 => Some(AccessPolicyAction::ChannelsCreate),
        110 => Some(AccessPolicyAction::ChannelsGet),
        120 => Some(AccessPolicyAction::ChannelsUpdate),
        130 => Some(AccessPolicyAction::ChannelsDelete),
        140 => Some(AccessPolicyAction::ChannelsList),
        150 => Some(AccessPolicyAction::ChannelsRead),
        160 => Some(AccessPolicyAction::ChannelsPost),
        200 => Some(AccessPolicyAction::AccessPoliciesCreate),
        210 => Some(AccessPolicyAction::AccessPoliciesGet),
        220 => Some(AccessPolicyAction::AccessPoliciesUpdate),
        230 => Some(AccessPolicyAction::AccessPoliciesDelete),
        240 => Some(AccessPolicyAction::AccessPoliciesList),
        _ => None,
    }
}

/// Subject-row visibility predicate. Builds the WHERE clause
/// fragment that decides which access_policies rows a given
/// `Subject` is allowed to "see" as matching against itself.
/// Mirrors filez's `filter_subject_access_policies!` macro,
/// inlined because chat's `Subject` carries the user_id + groups
/// directly (no ChatUser indirection).
///
/// `Anonymous` → only `Public` policies.
/// `User { user_id, groups, .. }` → Public + ServerMember + this
/// user's direct policies + any UserGroup policies whose
/// subject_id matches one of the user's groups.
fn build_subject_filter(
    subject: &Subject,
) -> Box<
    dyn diesel::BoxableExpression<
        schema::access_policies::table,
        diesel::pg::Pg,
        SqlType = diesel::sql_types::Bool,
    >,
> {
    use mows_auth_core::types::SubjectType;
    use schema::access_policies::dsl::*;
    match subject {
        Subject::Anonymous => Box::new(subject_type.eq(SubjectType::Public)),
        Subject::User {
            user_id,
            groups,
            ..
        } => {
            let uid = *user_id;
            let group_ids: Vec<Uuid> = groups.clone();
            Box::new(
                subject_type
                    .eq(SubjectType::Public)
                    .or(subject_type.eq(SubjectType::ServerMember))
                    .or(subject_type
                        .eq(SubjectType::User)
                        .and(subject_id.eq(uid)))
                    .or(subject_type
                        .eq(SubjectType::UserGroup)
                        .and(subject_id.eq_any(group_ids))),
            )
        }
    }
}

/// `NOT revoked AND (expires_at IS NULL OR expires_at > now())`
///
/// Hand-rolled SQL (not diesel DSL) for the same reason filez does
/// it: the `expires_at.gt(now)` expression types as
/// `Nullable<Bool>` because the column is nullable, and DSL `OR`s
/// can't unify Nullable<Bool> with Bool without an
/// `.assume_not_null()` chain that's noisier than the raw SQL.
fn lifecycle_filter() -> diesel::expression::SqlLiteral<diesel::sql_types::Bool> {
    diesel::dsl::sql::<diesel::sql_types::Bool>(
        "NOT access_policies.revoked AND \
         (access_policies.expires_at IS NULL OR access_policies.expires_at > now())",
    )
}

#[async_trait]
impl<'a> PolicyStore for ChatPolicyStore<'a> {
    async fn fetch_owners(
        &self,
        auth_info: &ResourceAuthInfo,
        resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Uuid>, AuthError> {
        let Some(owner_col) = auth_info.resource_table_owner_column else {
            return Ok(HashMap::new());
        };
        let mut connection = self
            .database
            .get_connection()
            .await
            .map_err(|e| AuthError::Evaluation(format!("pool: {e}")))?;
        // table/column names are identifier-validated at registry-build
        // time so format! splice is safe by construction (same
        // contract filez relies on).
        let query = format!(
            "SELECT {id_col} as resource_id, {owner_col} as owner_id \
             FROM {table_name} WHERE {id_col} = ANY($1)",
            table_name = auth_info.resource_table,
            id_col = auth_info.resource_table_id_column,
            owner_col = owner_col
        );
        let rows: Vec<OwnerRow> = diesel::sql_query(&query)
            .bind::<sql_types::Array<sql_types::Uuid>, _>(resource_ids)
            .load::<OwnerRow>(&mut connection)
            .await
            .map_err(|e| AuthError::Evaluation(format!("fetch_owners: {e}")))?;
        Ok(rows.into_iter().map(|r| (r.resource_id, r.owner_id)).collect())
    }

    async fn fetch_direct_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
        resource_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError> {
        let resource_type_enum = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .ok_or_else(|| {
                AuthError::Evaluation(format!(
                    "resource_type {} not registered in chat",
                    auth_info.resource_type
                ))
            })?;
        let action_enum = action_from_u32(action).ok_or_else(|| {
            AuthError::Evaluation(format!("AccessPolicyAction {action} not registered in chat"))
        })?;
        let app_id = MowsAppId(app.id);
        let mut connection = self
            .database
            .get_connection()
            .await
            .map_err(|e| AuthError::Evaluation(format!("pool: {e}")))?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.eq_any(resource_ids))
            .filter(schema::access_policies::resource_type.eq(resource_type_enum))
            .filter(
                schema::access_policies::context_app_ids.contains(vec![app_id]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(build_subject_filter(subject))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await
            .map_err(|e| AuthError::Evaluation(format!("fetch_direct_policies: {e}")))?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }

    async fn fetch_resource_group_memberships(
        &self,
        _auth_info: &ResourceAuthInfo,
        _resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<Uuid>>, AuthError> {
        // Chat doesn't ship a resource-grouping concept yet
        // (filez has file_groups → files; the chat equivalent
        // would be channel_groups → channels). The engine's
        // contract says "return empty if the type has no
        // group_membership_table" — which is exactly what every
        // chat resource type registers today.
        Ok(HashMap::new())
    }

    async fn fetch_resource_group_policies(
        &self,
        _auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        _app: AppView,
        _action: u32,
        _resource_group_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError> {
        Ok(vec![])
    }

    async fn fetch_type_level_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<PolicyView>, AuthError> {
        let resource_type_enum = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .ok_or_else(|| {
                AuthError::Evaluation(format!(
                    "resource_type {} not registered in chat",
                    auth_info.resource_type
                ))
            })?;
        let action_enum = action_from_u32(action).ok_or_else(|| {
            AuthError::Evaluation(format!("AccessPolicyAction {action} not registered in chat"))
        })?;
        let app_id = MowsAppId(app.id);
        let mut connection = self
            .database
            .get_connection()
            .await
            .map_err(|e| AuthError::Evaluation(format!("pool: {e}")))?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.is_null())
            .filter(schema::access_policies::resource_type.eq(resource_type_enum))
            .filter(schema::access_policies::context_app_ids.contains(vec![app_id]))
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            // Single-scope only (filez convention; owner-scoped
            // policies go through fetch_owner_scoped_policies but
            // chat doesn't use them yet).
            .filter(schema::access_policies::resource_scope.eq(0_i16))
            .filter(build_subject_filter(subject))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await
            .map_err(|e| AuthError::Evaluation(format!("fetch_type_level_policies: {e}")))?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }

    async fn list_visible_resource_ids(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<(Uuid, Effect)>, AuthError> {
        let resource_type_enum = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .ok_or_else(|| {
                AuthError::Evaluation(format!(
                    "resource_type {} not registered in chat",
                    auth_info.resource_type
                ))
            })?;
        let action_enum = action_from_u32(action).ok_or_else(|| {
            AuthError::Evaluation(format!("AccessPolicyAction {action} not registered in chat"))
        })?;
        let app_id = MowsAppId(app.id);
        let mut connection = self
            .database
            .get_connection()
            .await
            .map_err(|e| AuthError::Evaluation(format!("pool: {e}")))?;
        let mut pairs: Vec<(Uuid, Effect)> = Vec::new();

        // 1. Owner shortcut: every resource the caller owns is
        //    visible as an Allow pair. Skipped for Anonymous.
        if let (Some(owner_col), Subject::User { user_id, .. }) =
            (auth_info.resource_table_owner_column, subject)
        {
            let query = format!(
                "SELECT {id_col} as resource_id, {owner_col} as owner_id \
                 FROM {table_name} WHERE {owner_col} = $1",
                table_name = auth_info.resource_table,
                id_col = auth_info.resource_table_id_column,
                owner_col = owner_col
            );
            let owner_rows: Vec<OwnerRow> = diesel::sql_query(&query)
                .bind::<sql_types::Uuid, _>(*user_id)
                .load::<OwnerRow>(&mut connection)
                .await
                .map_err(|e| AuthError::Evaluation(format!("owner-list: {e}")))?;
            pairs.extend(owner_rows.into_iter().map(|r| (r.resource_id, Effect::Allow)));
        }

        // 2. Every contributing direct policy. Allow + Deny both
        //    emitted; the engine folds them into the final set.
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.is_not_null())
            .filter(schema::access_policies::resource_type.eq(resource_type_enum))
            .filter(schema::access_policies::context_app_ids.contains(vec![app_id]))
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(schema::access_policies::resource_scope.eq(0_i16))
            .filter(build_subject_filter(subject))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await
            .map_err(|e| AuthError::Evaluation(format!("list-direct: {e}")))?;

        for p in policies {
            if let Some(rid) = p.resource_id {
                pairs.push((rid, p.effect));
            }
        }

        Ok(pairs)
    }
}

/// `From<&AccessPolicy>` for the engine's `PolicyView`. Hoists the
/// fields the engine cares about (subject + effect + scope +
/// owner) without leaking chat's diesel newtypes.
impl From<&AccessPolicy> for PolicyView {
    fn from(p: &AccessPolicy) -> Self {
        PolicyView {
            id: p.id.0,
            owner_id: p.owner_id.0,
            subject_type: p.subject_type,
            subject_id: p.subject_id,
            effect: p.effect,
            resource_scope: p.resource_scope,
        }
    }
}
