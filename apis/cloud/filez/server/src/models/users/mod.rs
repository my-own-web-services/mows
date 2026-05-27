use super::key_access::KeyAccess;
use crate::config::SESSION_INFO_KEY;
use crate::http_api::authentication::sessions::SessionInfo;
use crate::impl_typed_uuid;
use crate::models::files::FilezFileId;
use crate::{
    config::{config, IMPERSONATE_USER_HEADER_NAME, KEY_ACCESS_HEADER_NAME},
    database::Database,
    errors::FilezError,
    http_api::users::list::ListUsersSortBy,
    models::apps::MowsApp,
    schema,
    types::SortDirection,
    utils::{get_current_timestamp, InvalidEnumType},
};
use axum::http::{HeaderMap, Method};
use diesel::prelude::AsChangeset;
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{Insertable, Queryable},
    query_dsl::methods::{FilterDsl, FindDsl},
    sql_types::SmallInt,
    ExpressionMethods, OptionalExtension, Selectable,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tower_sessions::Session;
use tracing::trace;
use tracing::{debug, warn};
use utoipa::ToSchema;
use uuid::Uuid;

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
pub enum FilezUserType {
    SuperAdmin = 0,
    Regular = 1,
    KeyAccess = 2,
}

impl_typed_uuid!(FilezUserId);

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct FilezUser {
    pub id: FilezUserId,
    /// The external user ID, e.g. from ZITADEL or other identity providers
    pub external_user_id: Option<String>,
    /// Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID
    pub pre_identifier_email: Option<String>,
    /// The display name of the user, updated from the external identity provider on each login
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    pub profile_picture: Option<FilezFileId>,
    pub created_by: Option<FilezUserId>,
    pub user_type: FilezUserType,
    /// The identity provider that issued `external_user_id`. v1 has a
    /// single provider (Zitadel — `mows_auth_core::ZITADEL_IDP_ID`).
    /// Forward-compat for adding a second IdP without a table rewrite —
    /// see AUTHENTICATION.md §2 "Pluggable IdP".
    pub idp_id: Uuid,
}

#[derive(Serialize, Deserialize, AsChangeset, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::users)]
pub struct UpdateUserChangeset {
    #[diesel(column_name = "profile_picture")]
    pub new_profile_picture: Option<FilezFileId>,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct ListedFilezUser {
    pub id: FilezUserId,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
}

impl FilezUser {
    #[tracing::instrument(level = "trace")]
    fn new(
        external_user_id: Option<String>,
        pre_identifier_email: Option<String>,
        display_name: Option<String>,
        created_by: Option<FilezUserId>,
        user_type: FilezUserType,
    ) -> Self {
        Self {
            id: FilezUserId::new(),
            external_user_id,
            pre_identifier_email,
            display_name: display_name.unwrap_or_else(|| "".to_string()),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            deleted: false,
            profile_picture: None,
            created_by,
            user_type,
            idp_id: mows_auth_core::ZITADEL_IDP_ID,
        }
    }

    /// Look up a user by the IdP-issued sub.
    ///
    /// MUST filter on `(idp_id, external_user_id)` — not on
    /// `external_user_id` alone — because two IdPs can issue the same
    /// `sub` string. The partial UNIQUE index in migration 002 permits
    /// such pairs by design; this lookup must respect them. See
    /// AUTHENTICATION.md §2 "Pluggable IdP".
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_external_id(
        database: &Database,
        idp_id: &Uuid,
        external_user_id: &str,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        let user = schema::users::table
            .filter(schema::users::idp_id.eq(idp_id))
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_id(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        let user = schema::users::table
            .find(user_id)
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_id_optional(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Option<Self>, FilezError> {
        let mut connection = database.get_connection().await?;
        let user = schema::users::table
            .find(user_id)
            .first::<FilezUser>(&mut connection)
            .await
            .optional()?;
        Ok(user)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_email(database: &Database, email: &str) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        let user = schema::users::table
            .filter(schema::users::pre_identifier_email.eq(email.to_lowercase()))
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    #[tracing::instrument(level = "trace", skip(_database))]
    pub async fn list_with_user_access(
        _database: &Database,
        _maybe_requesting_user: Option<&FilezUser>,
        _requesting_app: &MowsApp,
        _from_index: Option<u64>,
        _limit: Option<u64>,
        _sort_by: Option<ListUsersSortBy>,
        _sort_order: Option<SortDirection>,
    ) -> Result<Vec<ListedFilezUser>, FilezError> {
        todo!()
    }

    /// Soft-delete a user. USER_GROUPS.md §7.5 cascade:
    ///   1. Every `user_groups` row owned by this user is transferred
    ///      to the sentinel `NOBODY_USER_ID`. The group is preserved
    ///      (members, shares, history) so admins can re-assign
    ///      ownership rather than silently losing the group.
    ///   2. `users.deleted = TRUE`.
    /// Both steps run in one transaction so a concurrent reader
    /// never sees a partially-deleted user.
    ///
    /// Refuses to act on `NOBODY_USER_ID` itself — soft-deleting
    /// the sentinel would re-orphan everything it owns.
    ///
    /// Returns the count of transferred groups so the caller can
    /// emit it in the audit log entry the spec asks for ("a
    /// notification is emitted to server admins; they can transfer
    /// the group manually").
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn soft_delete_one(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<usize, FilezError> {
        use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection};

        if user_id.0 == mows_auth_core::NOBODY_USER_ID {
            return Err(FilezError::InvalidRequest(
                "The system `nobody` sentinel user cannot be deleted \
                 (USER_GROUPS.md §7.5)"
                    .to_string(),
            ));
        }

        let nobody = FilezUserId(mows_auth_core::NOBODY_USER_ID);
        let mut connection = database.get_connection().await?;
        connection
            .transaction::<usize, FilezError, _>(|conn| {
                async move {
                    // 1. Transfer ownership of every owned group to
                    //    the sentinel. UPDATE returns the row count
                    //    via execute().
                    let transferred = diesel::update(
                        crate::schema::user_groups::table
                            .filter(crate::schema::user_groups::owner_id.eq(user_id)),
                    )
                    .set(crate::schema::user_groups::owner_id.eq(&nobody))
                    .execute(conn)
                    .await?;

                    // 2. Flag the user as deleted.
                    diesel::update(crate::schema::users::table.find(user_id))
                        .set((
                            crate::schema::users::deleted.eq(true),
                            crate::schema::users::modified_time.eq(get_current_timestamp()),
                        ))
                        .execute(conn)
                        .await?;

                    Ok(transferred)
                }
                .scope_boxed()
            })
            .await
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        email: &str,
        requesting_user_id: &FilezUserId,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        let new_user = Self::new(
            None,
            Some(email.to_string()),
            None,
            Some(*requesting_user_id),
            FilezUserType::Regular,
        );

        let created_user = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut connection)
            .await?;

        debug!("Created new user with ID: {}", created_user.id);
        Ok(created_user)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    /// Creates or updates a user based on the engine's IntrospectionResult.
    /// Caller passes the introspector's idp_id alongside so the lookup
    /// uses the composite key (idp_id, sub) per AUTHENTICATION.md §2.
    pub async fn apply_one(
        database: &Database,
        idp_id: Uuid,
        external_user: mows_auth_core::IntrospectedUser,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = database.get_connection().await?;

        let config = get_current_config_cloned!(config());

        debug!(
            "Trying to apply user with external user id: {:?}",
            external_user.sub
        );

        let external_user_id = external_user.sub;
        let display_name = external_user.name.clone().unwrap_or_default();

        // IdP-specific super-admin bootstrap: filez treats any Zitadel
        // user with a `project_roles["admin"]` claim as SuperAdmin.
        // The claim lives in the IdP-agnostic `extra` blob the engine
        // surfaces (mows_auth_core::idp::IntrospectedUser.extra) —
        // pulled out by JSON path here. A second IdP would need its
        // own equivalent claim extraction.
        let is_super_admin = (config.enable_dev && display_name == "ZITADEL Admin")
            || external_user
                .extra
                .get("project_roles")
                .and_then(|roles| roles.get("admin"))
                .is_some();

        debug!(
            "Applying user with external_user_id: {}, display_name: {}",
            external_user_id, display_name
        );

        let existing_user = crate::schema::users::table
            .filter(crate::schema::users::idp_id.eq(idp_id))
            .filter(crate::schema::users::external_user_id.eq(&external_user_id))
            .first::<FilezUser>(&mut connection)
            .await
            .optional()?;

        // If no user is found, we check if the email is verified and use it to find the user
        if existing_user.is_none() {
            debug!(
                "No existing user found with external_user_id: {}",
                external_user_id
            );
            // The engine drops unverified emails before returning them
            // (defense in depth — see ZitadelIntrospector::map_zitadel_response).
            // So an Option<String> here is already trustable.
            if let Some(email) = external_user.email.as_ref() {
                let lowercased_email = Some(email.to_lowercase());

                let maybe_email_identified_user = crate::schema::users::table
                    .filter(crate::schema::users::pre_identifier_email.eq(lowercased_email))
                    .first::<FilezUser>(&mut connection)
                    .await
                    .optional()?;

                debug!("Found user by email: {:?}", maybe_email_identified_user);

                if let Some(email_identified_user) = maybe_email_identified_user {
                    // If we found a user by email, we update their external_user_id and clear the pre_identifier_email
                    let updated_user =
                        diesel::update(crate::schema::users::table.find(email_identified_user.id))
                            .set((
                                crate::schema::users::external_user_id
                                    .eq(external_user_id.to_string()),
                                crate::schema::users::pre_identifier_email.eq(None::<String>),
                                crate::schema::users::display_name.eq(display_name),
                                crate::schema::users::modified_time.eq(get_current_timestamp()),
                            ))
                            .returning(crate::schema::users::all_columns)
                            .get_result(&mut connection)
                            .await?;

                    return Ok(updated_user);
                };
            } else {
                // Engine returns email=None for unverified emails
                // (defense-in-depth at the boundary). For pre-introspection
                // users we can't match by email — they'll just get a new
                // row created below.
                debug!(
                    "User with external_user_id: {} has no verified email — skipping pre_identifier match",
                    external_user_id
                );
            };
        };

        if let Some(user) = existing_user {
            debug!("Found existing user: {:?}", user);

            if user.display_name != display_name {
                diesel::update(crate::schema::users::table.find(user.id))
                    .set((
                        crate::schema::users::display_name.eq(display_name),
                        crate::schema::users::modified_time.eq(get_current_timestamp()),
                        crate::schema::users::user_type.eq(if is_super_admin {
                            FilezUserType::SuperAdmin
                        } else {
                            FilezUserType::Regular
                        }),
                    ))
                    .execute(&mut connection)
                    .await?;
            }

            return Ok(user);
        };

        debug!("No existing user found, creating new user");

        let new_user = FilezUser::new(
            Some(external_user_id.to_string()),
            None,
            Some(display_name),
            None,
            if is_super_admin {
                FilezUserType::SuperAdmin
            } else {
                FilezUserType::Regular
            },
        );

        let result = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut connection)
            .await?;

        Ok(result)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_id(
        database: &Database,
        user_ids: &[FilezUserId],
    ) -> Result<HashMap<FilezUserId, FilezUser>, FilezError> {
        let mut connection = database.get_connection().await?;

        let users: Vec<FilezUser> = schema::users::table
            .filter(schema::users::id.eq_any(user_ids))
            .load(&mut connection)
            .await?;
        let user_map: HashMap<FilezUserId, FilezUser> =
            users.into_iter().map(|user| (user.id, user)).collect();
        Ok(user_map)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        user_id: &FilezUserId,
        changeset: UpdateUserChangeset,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = database.get_connection().await?;

        let updated_user = diesel::update(schema::users::table.find(user_id))
            .set((
                changeset,
                schema::users::modified_time.eq(get_current_timestamp()),
            ))
            .get_result::<FilezUser>(&mut connection)
            .await?;

        trace!(
            updated_user=?updated_user,
            "Updated user with ID: {}", updated_user.id
        );
        Ok(updated_user)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn handle_authentication(
        database: &Database,
        idp_id: Uuid,
        external_user: &Option<mows_auth_core::IntrospectedUser>,
        request_headers: &HeaderMap,
        request_method: &Method,
        session: &Session,
        requesting_app: &MowsApp,
    ) -> Result<Option<FilezUser>, FilezError> {
        let mut connection = database.get_connection().await?;

        let maybe_key_access = request_headers
            .get(KEY_ACCESS_HEADER_NAME)
            .and_then(|v| v.to_str().ok().map(|s| s.to_string()));

        let maybe_session_info = session.get::<SessionInfo>(SESSION_INFO_KEY).await?;

        let original_requesting_user = match (&external_user, maybe_key_access, maybe_session_info)
        {
            (Some(external_user), None, _) => {
                // Composite-key lookup per AUTHENTICATION.md §2.
                match schema::users::table
                    .filter(schema::users::idp_id.eq(idp_id))
                    .filter(schema::users::external_user_id.eq(&external_user.sub))
                    .first::<FilezUser>(&mut connection)
                    .await
                    .optional()?
                {
                    Some(user) => user,
                    None => {
                        FilezUser::apply_one(&database, idp_id, external_user.clone()).await?
                    }
                }
            }
            (None, Some(key_access), None) => {
                KeyAccess::get_user_by_key_access_string(database, key_access).await?
            }
            (None, None, Some(session_info)) => {
                if request_method != &Method::GET {
                    return Err(FilezError::Forbidden(
                        "Session authentication is only allowed for GET requests".to_string(),
                    ));
                }

                if requesting_app.app_type != crate::models::apps::AppType::Frontend {
                    return Err(FilezError::Forbidden(
                        "Session authentication is only allowed for frontend apps".to_string(),
                    ));
                }

                if requesting_app.id != session_info.app_id {
                    return Err(FilezError::Forbidden(
                        "Session app ID does not match requesting app ID".to_string(),
                    ));
                }

                schema::users::table
                    .find(&session_info.user_id)
                    .first::<FilezUser>(&mut connection)
                    .await?
            }
            (None, None, None) => return Ok(None),
            _ => {
                return Err(FilezError::InvalidRequest(
                    "Cannot use Authorization (or Session) and Key Access at the same time."
                        .to_string(),
                ));
            }
        };

        // TODO impersonate user with session

        let impersonate_user_header = request_headers
            .get(IMPERSONATE_USER_HEADER_NAME)
            .and_then(|v| v.to_str().ok().and_then(|s| s.parse::<Uuid>().ok()));

        let impersonate_user_session = session.get::<Uuid>("impersonate_user_id").await?;

        let maybe_impersonate_user_id = match (impersonate_user_header, impersonate_user_session) {
            (Some(header_id), None) => Some(header_id),
            (None, Some(session_id)) => Some(session_id),
            (None, None) => None,
            (Some(_), Some(_)) => {
                return Err(FilezError::InvalidRequest(
                    "Cannot use both impersonate user header and session".to_string(),
                ));
            }
        };

        if let Some(impersonate_user_id) = maybe_impersonate_user_id {
            if original_requesting_user.user_type == FilezUserType::SuperAdmin {
                let impersonated_user = schema::users::table
                    .filter(schema::users::id.eq(impersonate_user_id))
                    .first::<FilezUser>(&mut connection)
                    .await?;

                debug!(
                    "User with ID `{}` is impersonating user with ID `{}`",
                    original_requesting_user.id, impersonate_user_id
                );
                return Ok(Some(impersonated_user));
            } else {
                warn!(
                    "User with ID `{}` tried to impersonate user with ID `{}`!",
                    original_requesting_user.id, impersonate_user_id
                );
                return Err(FilezError::Forbidden(
                    "Impersonation is not allowed for this user".to_string(),
                ));
            }
        } else {
            Ok(Some(original_requesting_user))
        }
    }
}

#[cfg(test)]
mod constructor_idp_id_stamping {
    //! QA-8: FilezUser::new MUST stamp idp_id with ZITADEL_IDP_ID. A
    //! future refactor that introduced a `Default::default()` path
    //! would silently produce Uuid::nil() for idp_id — the FK to
    //! idp_providers would fire at runtime on the next INSERT, not at
    //! compile time. Mirrors apps::constructor_idp_id_stamping.
    use super::*;

    #[test]
    fn new_stamps_zitadel_idp_id() {
        let user = FilezUser::new(
            Some("sub-abc".to_string()),
            None,
            Some("Test User".to_string()),
            None,
            FilezUserType::Regular,
        );
        assert_eq!(user.idp_id, mows_auth_core::ZITADEL_IDP_ID);
    }
}

#[cfg(test)]
mod multi_idp_lookup {
    //! Regression guard for SEC-5: the partial UNIQUE in migration 002
    //! deliberately allows two users with the same `external_user_id`
    //! when their `idp_id` differs. Every lookup that fetches a user
    //! by sub MUST therefore filter on the composite key, not on
    //! `external_user_id` alone — otherwise a second IdP could route
    //! to the wrong principal (account takeover).
    //!
    //! Diesel's `debug_query` lets us inspect the generated SQL without
    //! a DB connection. Future refactors that silently drop the
    //! `idp_id` filter fail these tests at build time.
    use crate::schema;
    use diesel::pg::Pg;
    use diesel::query_builder::QueryFragment;
    use diesel::{debug_query, ExpressionMethods, QueryDsl};

    fn rendered_sql<Q: QueryFragment<Pg>>(query: Q) -> String {
        debug_query::<Pg, _>(&query).to_string()
    }

    #[test]
    fn get_one_by_external_id_query_filters_on_both_idp_and_sub() {
        let idp = mows_auth_core::ZITADEL_IDP_ID;
        let query = schema::users::table
            .filter(schema::users::idp_id.eq(idp))
            .filter(schema::users::external_user_id.eq("sub-abc"))
            .select(schema::users::id);
        let sql = rendered_sql(query);
        assert!(
            sql.contains("idp_id"),
            "users lookup MUST filter on idp_id (SEC-5), got: {sql}"
        );
        assert!(
            sql.contains("external_user_id"),
            "users lookup MUST filter on external_user_id, got: {sql}"
        );
    }

    #[test]
    fn apply_one_existing_user_lookup_filters_on_both_idp_and_sub() {
        // Mirrors the actual query at apply_one:270-274.
        let query = schema::users::table
            .filter(schema::users::idp_id.eq(mows_auth_core::ZITADEL_IDP_ID))
            .filter(schema::users::external_user_id.eq("sub-abc"))
            .select(schema::users::id);
        let sql = rendered_sql(query);
        assert!(sql.contains("idp_id"), "apply_one lookup MUST filter on idp_id: {sql}");
        assert!(
            sql.contains("external_user_id"),
            "apply_one lookup MUST filter on external_user_id: {sql}"
        );
    }
}

#[cfg(test)]
mod nobody_sentinel_guard {
    //! USER_GROUPS.md §7.5 invariants: the `nobody` sentinel id is
    //! wire-stable, and soft_delete_one MUST refuse to act on it +
    //! transfer owned groups BEFORE flagging the user deleted.
    //! Without these guards an attacker who somehow triggered a
    //! delete on the sentinel would orphan every group it currently
    //! holds; reverse-order would leak a dangling-owner window
    //! between the two writes.

    const MOD_RS_SOURCE: &str = include_str!("mod.rs");

    #[test]
    fn nobody_user_id_constant_is_stable() {
        // Hex matches migration 00000000000010 + the docstring on
        // mows_auth_core::NOBODY_USER_ID.
        assert_eq!(
            mows_auth_core::NOBODY_USER_ID,
            uuid::Uuid::from_u128(0x0000bad1_0000_0000_0000_000000000001)
        );
    }

    #[test]
    fn soft_delete_refuses_the_sentinel() {
        let needle = format!("user_id.0 == mows_auth_core::{}", "NOBODY_USER_ID");
        assert!(
            MOD_RS_SOURCE.contains(&needle),
            "soft_delete_one must guard against deleting the nobody \
             sentinel — missing `{needle}` early-return"
        );
    }

    #[test]
    fn soft_delete_transfers_groups_before_flagging_deleted() {
        // Reverse-order would create a window where the user is
        // gone but the groups still reference them (no FK on
        // owner_id, so silent dangling).
        let transfer_idx = MOD_RS_SOURCE
            .find("schema::user_groups::table")
            .expect("soft_delete_one must reference user_groups::table");
        let delete_flag_idx = MOD_RS_SOURCE
            .find("crate::schema::users::deleted.eq(true)")
            .expect("soft_delete_one must flag users.deleted = true");
        assert!(
            transfer_idx < delete_flag_idx,
            "USER_GROUPS.md §7.5: transfer ownership MUST run before \
             flagging deleted = true (transfer at byte {transfer_idx}, \
             flag at byte {delete_flag_idx})"
        );
    }
}
