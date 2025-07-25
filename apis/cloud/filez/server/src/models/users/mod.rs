use crate::{
    api::users::list::ListUsersSortBy,
    config::{config, IMPERSONATE_USER_HEADER, KEY_ACCESS_HEADER},
    errors::FilezError,
    schema,
    types::SortDirection,
    utils::{get_uuid, InvalidEnumType},
};
use axum::http::HeaderMap;
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
use tracing::{debug, warn};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use super::key_access::KeyAccess;

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
    Password = 2,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct FilezUser {
    pub id: Uuid,
    /// The external user ID, e.g. from ZITADEL or other identity providers
    pub external_user_id: Option<String>,
    /// Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID
    pub pre_identifier_email: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    pub profile_picture: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub user_type: FilezUserType,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct ListedFilezUser {
    pub id: Uuid,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
}

impl FilezUser {
    pub fn new(
        external_user_id: Option<String>,
        pre_identifier_email: Option<String>,
        display_name: Option<String>,
        created_by: Option<Uuid>,
        user_type: FilezUserType,
    ) -> Self {
        Self {
            id: get_uuid(),
            external_user_id,
            pre_identifier_email,
            display_name: display_name.unwrap_or_else(|| "".to_string()),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            deleted: false,
            profile_picture: None,
            created_by,
            user_type,
        }
    }

    pub async fn get_by_external_id(
        db: &crate::db::Db,
        external_user_id: &str,
    ) -> Result<Self, FilezError> {
        let mut connection = db.get_connection().await?;
        let user = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    pub async fn get_by_id(db: &crate::db::Db, user_id: &Uuid) -> Result<Self, FilezError> {
        let mut connection = db.get_connection().await?;
        let user = schema::users::table
            .find(user_id)
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    pub async fn get_by_email(db: &crate::db::Db, email: &str) -> Result<Self, FilezError> {
        let mut connection = db.get_connection().await?;
        let user = schema::users::table
            .filter(schema::users::pre_identifier_email.eq(email.to_lowercase()))
            .first::<FilezUser>(&mut connection)
            .await?;
        Ok(user)
    }

    pub async fn list_with_user_access(
        _db: &crate::db::Db,
        _requesting_user_id: &Uuid,
        _app_id: &Uuid,
        _from_index: Option<i64>,
        _limit: Option<i64>,
        _sort_by: Option<ListUsersSortBy>,
        _sort_order: Option<SortDirection>,
    ) -> Result<Vec<ListedFilezUser>, FilezError> {
        todo!()
    }

    pub async fn delete(db: &crate::db::Db, user_id: &Uuid) -> Result<(), FilezError> {
        let mut connection = db.get_connection().await?;
        diesel::update(crate::schema::users::table.find(user_id))
            .set((
                crate::schema::users::deleted.eq(true),
                crate::schema::users::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn create(
        db: &crate::db::Db,
        email: &str,
        requesting_user_id: &Uuid,
    ) -> Result<Self, FilezError> {
        let mut connection = db.get_connection().await?;
        let new_user = Self::new(
            None,
            Some(email.to_string()),
            None,
            Some(*requesting_user_id),
            FilezUserType::Regular,
        );

        let result = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut connection)
            .await?;

        debug!("Created new user with ID: {}", result.id);
        Ok(result)
    }

    pub async fn apply(
        db: &crate::db::Db,
        external_user: IntrospectedUser,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = db.get_connection().await?;

        let config = get_current_config_cloned!(config());

        debug!(
            "Trying to apply user with external user id: {:?}",
            external_user.user_id
        );

        let external_user_id = external_user
            .user_id
            .as_ref()
            .ok_or_else(|| FilezError::Unauthorized("External user ID is missing".to_string()))?;

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
            .filter(crate::schema::users::external_user_id.eq(external_user_id))
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
                                crate::schema::users::modified_time
                                    .eq(chrono::Utc::now().naive_utc()),
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
                        crate::schema::users::modified_time.eq(chrono::Utc::now().naive_utc()),
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

    pub async fn get_many_by_id(
        db: &crate::db::Db,
        user_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, FilezUser>, FilezError> {
        let mut connection = db.get_connection().await?;

        let users: Vec<FilezUser> = schema::users::table
            .filter(schema::users::id.eq_any(user_ids))
            .load(&mut connection)
            .await?;
        let user_map: HashMap<Uuid, FilezUser> =
            users.into_iter().map(|user| (user.id, user)).collect();
        Ok(user_map)
    }

    pub async fn get_from_external(
        db: &crate::db::Db,
        external_user: &IntrospectedUser,
        request_headers: &HeaderMap,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = db.get_connection().await?;

        let maybe_key_access = request_headers
            .get(KEY_ACCESS_HEADER)
            .and_then(|v| v.to_str().ok().map(|s| s.to_string()));

        let original_requesting_user = match (&external_user.user_id, maybe_key_access) {
            (Some(external_user_id), None) => {
                schema::users::table
                    .filter(schema::users::external_user_id.eq(external_user_id))
                    .first::<FilezUser>(&mut connection)
                    .await?
            }
            (None, Some(key_access)) => {
                KeyAccess::get_user_by_key_access_string(db, key_access).await?
            }
            (Some(external_user_id), Some(key_access)) => {
                return Err(FilezError::InvalidRequest(
                    "Cannot use both external user ID and key access header".to_string(),
                ));
            }

            (None, None) => {
                return Err(FilezError::Unauthorized(
                    "User could not be determined from request headers".to_string(),
                ));
            }
        };

        if let Some(impersonate_user_id) = request_headers
            .get(IMPERSONATE_USER_HEADER)
            .and_then(|v| v.to_str().ok().and_then(|s| s.parse::<Uuid>().ok()))
        {
            if original_requesting_user.user_type == FilezUserType::SuperAdmin {
                let impersonated_user = schema::users::table
                    .filter(schema::users::id.eq(impersonate_user_id))
                    .first::<FilezUser>(&mut connection)
                    .await?;

                debug!(
                    "User with external_user_id `{}` is impersonating user with ID `{}`",
                    external_user.user_id.clone().unwrap(),
                    impersonate_user_id
                );
                return Ok(impersonated_user);
            } else {
                warn!(
                    "User with external_user_id `{}` tried to impersonate user with ID `{}`!",
                    external_user.user_id.clone().unwrap(),
                    impersonate_user_id
                );
                return Err(FilezError::Forbidden(
                    "Impersonation is not allowed for this user".to_string(),
                ));
            }
        } else {
            Ok(original_requesting_user)
        }
    }
}
