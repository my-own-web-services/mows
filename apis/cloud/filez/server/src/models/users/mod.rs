use super::key_access::KeyAccess;
use crate::config::SESSION_INFO_KEY;
use crate::http_api::authentication::sessions::SessionInfo;
use crate::http_api::authentication::user::IntrospectedUser;
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
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_external_id(
        database: &Database,
        external_user_id: &str,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        let user = schema::users::table
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

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn soft_delete_one(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::update(crate::schema::users::table.find(user_id))
            .set((
                crate::schema::users::deleted.eq(true),
                crate::schema::users::modified_time.eq(get_current_timestamp()),
            ))
            .execute(&mut connection)
            .await?;
        Ok(())
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
    /// Creates or updates a user based on the provided external user information.
    pub async fn apply_one(
        database: &Database,
        external_user: IntrospectedUser,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = database.get_connection().await?;

        let config = get_current_config_cloned!(config());

        debug!(
            "Trying to apply user with external user id: {:?}",
            external_user.user_id
        );

        let external_user_id = external_user.user_id;

        let display_name = external_user.name.unwrap_or("".to_string());

        let is_super_admin = (config.enable_dev && display_name == "ZITADEL Admin")
            || external_user
                .project_roles
                .as_ref()
                .and_then(|roles| roles.get("admin"))
                .is_some();

        debug!(
            "Applying user with external_user_id: {}, display_name: {}",
            external_user_id, display_name
        );

        let existing_user = crate::schema::users::table
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
            if external_user
                .email_verified
                .is_some_and(|verified| verified)
            {
                let lowercased_email = external_user
                    .email
                    .clone()
                    .and_then(|email| email.to_lowercase().into());

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
                debug!(
                    "User with external_user_id: {} has not verified their email",
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
        external_user: &Option<IntrospectedUser>,
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
                match schema::users::table
                    .filter(schema::users::external_user_id.eq(&external_user.user_id))
                    .first::<FilezUser>(&mut connection)
                    .await
                    .optional()?
                {
                    Some(user) => user,
                    None => FilezUser::apply_one(&database, external_user.clone()).await?,
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
