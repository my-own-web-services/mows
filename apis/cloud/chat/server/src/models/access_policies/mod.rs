//! Chat-side access-policy machinery — engine glue for the
//! `mows-auth-core` integration.
//!
//! Three pieces:
//!   * `AccessPolicyResourceType` — chat's resource types, mapped
//!     onto the engine's `ResourceTypeRegistry`.
//!   * `AccessPolicyAction` — the chat actions a policy can grant
//!     or deny. SMALLINT-backed, wire-stable.
//!   * `AccessPolicy` — diesel row + `check_one` helper that calls
//!     into `mows_auth_core::check_access` via [`store::ChatPolicyStore`].
//!
//! MVP scope (Round 2 of Phase 6 in
//! `.plans/chat-service/PLAN.md`): User + Public + ServerMember
//! subject types are honoured by the store. UserGroup subjects are
//! schematically possible (the SQL queries handle them) but no
//! `user_groups` schema is shipped yet, so a caller-supplied
//! empty groups list means UserGroup policies are inert. Round
//! 4 adds the user_groups tables + the introspector wiring that
//! resolves a user's groups; until then per-user share works.

pub mod check;
pub mod store;

use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*,
    sql_types::SmallInt,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use mows_auth_core::types::{Effect, SubjectType};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    database::Database,
    errors::ChatError,
    impl_typed_uuid,
    models::{apps::MowsAppId, users::FilezUserId},
    schema,
    utils::{get_current_timestamp, InvalidEnumType},
};

impl_typed_uuid!(AccessPolicyId);

/// Resource types chat exposes to the engine. Discriminants are
/// SMALLINT-backed and **wire-stable** — changing a number means
/// every stored access_policies row's `resource_type` column also
/// changes meaning. Add new variants at the end with explicit
/// discriminants; never renumber.
#[derive(
    Debug,
    Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyResourceType {
    Channel = 0,
    User = 1,
    AccessPolicy = 2,
    MowsApp = 3,
}

impl AccessPolicyResourceType {
    pub fn from_u32(t: u32) -> Option<Self> {
        match t {
            0 => Some(Self::Channel),
            1 => Some(Self::User),
            2 => Some(Self::AccessPolicy),
            3 => Some(Self::MowsApp),
            _ => None,
        }
    }
}

/// Actions a policy can authorise or forbid on a chat resource.
/// Gaps in the discriminant sequence are deliberate — leaves
/// space for sibling actions on the same surface (filez's gap
/// pattern).
#[derive(
    DbEnum,
    Debug,
    Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyAction {
    ChannelsCreate = 100,
    ChannelsGet = 110,
    ChannelsUpdate = 120,
    ChannelsDelete = 130,
    ChannelsList = 140,
    ChannelsRead = 150,
    ChannelsPost = 160,

    AccessPoliciesCreate = 200,
    AccessPoliciesGet = 210,
    AccessPoliciesUpdate = 220,
    AccessPoliciesDelete = 230,
    AccessPoliciesList = 240,
}

/// One row in `access_policies`. Mirrors filez's struct shape so a
/// future shared model can hoist both.
#[derive(
    Queryable,
    Selectable,
    Clone,
    Insertable,
    Debug,
    QueryableByName,
    Serialize,
    Deserialize,
    ToSchema,
)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = schema::access_policies)]
pub struct AccessPolicy {
    pub id: AccessPolicyId,
    pub owner_id: FilezUserId,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub subject_type: SubjectType,
    pub subject_id: Uuid,
    pub context_app_ids: Vec<MowsAppId>,
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub actions: Vec<AccessPolicyAction>,
    pub effect: Effect,
    pub resource_scope: mows_auth_core::types::ResourceScope,
    pub expires_at: Option<chrono::NaiveDateTime>,
    pub revoked: bool,
    pub policy_bundle_id: Option<Uuid>,
}

impl AccessPolicy {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        name: &str,
        owner_id: FilezUserId,
        subject_type: SubjectType,
        subject_id: Uuid,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: Effect,
    ) -> Self {
        Self {
            id: AccessPolicyId::new(),
            owner_id,
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            subject_type,
            subject_id,
            context_app_ids,
            resource_type,
            resource_id,
            actions,
            effect,
            resource_scope: mows_auth_core::types::ResourceScope::Single,
            expires_at: None,
            revoked: false,
            policy_bundle_id: None,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    #[allow(clippy::too_many_arguments)]
    pub async fn create_one(
        database: &Database,
        name: &str,
        owner_id: FilezUserId,
        subject_type: SubjectType,
        subject_id: Uuid,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: Effect,
    ) -> Result<AccessPolicy, ChatError> {
        let policy = AccessPolicy::new(
            name,
            owner_id,
            subject_type,
            subject_id,
            context_app_ids,
            resource_type,
            resource_id,
            actions,
            effect,
        );
        let mut connection = database.get_connection().await?;
        let created = diesel::insert_into(schema::access_policies::table)
            .values(&policy)
            .returning(AccessPolicy::as_select())
            .get_result::<AccessPolicy>(&mut connection)
            .await?;
        Ok(created)
    }
}
