use crate::{
    api::users::list::ListUsersSortBy, config::config, errors::FilezError, schema,
    types::SortDirection, utils::get_uuid,
};
use axum::http::HeaderMap;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    query_dsl::methods::{FilterDsl, FindDsl},
    ExpressionMethods, OptionalExtension, Selectable,
};
use diesel_async::RunQueryDsl;
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, warn};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct FilezUser {
    pub id: Uuid,
    pub external_user_id: Option<String>,
    /// Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID
    pub pre_identifier_email: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    pub profile_picture: Option<Uuid>,
    pub created_by: Option<Uuid>,
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
        }
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
        let mut conn = db.pool.get().await?;
        diesel::update(crate::schema::users::table.find(user_id))
            .set((
                crate::schema::users::deleted.eq(true),
                crate::schema::users::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn create(
        db: &crate::db::Db,
        email: &str,
        requesting_user_id: &Uuid,
    ) -> Result<Self, FilezError> {
        let mut conn = db.pool.get().await?;
        let new_user = Self::new(
            None,
            Some(email.to_string()),
            None,
            Some(*requesting_user_id),
        );

        let result = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut conn)
            .await?;

        debug!("Created new user with ID: {}", result.id);
        Ok(result)
    }

    pub async fn apply(
        db: &crate::db::Db,
        external_user: IntrospectedUser,
    ) -> Result<uuid::Uuid, FilezError> {
        let mut conn = db.pool.get().await?;
        let external_user_id = external_user
            .user_id
            .as_ref()
            .ok_or_else(|| FilezError::Unauthorized("External user ID is missing".to_string()))?;

        let display_name = external_user.preferred_username.unwrap_or("".to_string());
        let project_roles = external_user.project_roles.clone();

        let existing_user = crate::schema::users::table
            .filter(crate::schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut conn)
            .await
            .optional()?;

        // If no user is found, we check if the email is verified and use it to find the user
        if existing_user.is_none() {
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
                    .first::<FilezUser>(&mut conn)
                    .await
                    .optional()?;

                if let Some(email_identified_user) = maybe_email_identified_user {
                    // If we found a user by email, we update their external_user_id and clear the pre_identifier_email
                    diesel::update(crate::schema::users::table.find(email_identified_user.id))
                        .set((
                            crate::schema::users::external_user_id.eq(external_user_id.to_string()),
                            crate::schema::users::pre_identifier_email.eq(None::<String>),
                            crate::schema::users::display_name.eq(display_name),
                            crate::schema::users::modified_time.eq(chrono::Utc::now().naive_utc()),
                        ))
                        .execute(&mut conn)
                        .await?;

                    return Ok(email_identified_user.id);
                };
            } else {
                return Err(FilezError::Unauthorized(
                    "Users Email is not verified".to_string(),
                ));
            };
        };

        if let Some(user) = existing_user {
            if user.display_name != display_name {
                diesel::update(crate::schema::users::table.find(user.id))
                    .set((
                        crate::schema::users::display_name.eq(display_name),
                        crate::schema::users::modified_time.eq(chrono::Utc::now().naive_utc()),
                    ))
                    .execute(&mut conn)
                    .await?;
            }
            return Ok(user.id);
        };

        let new_user = FilezUser::new(
            Some(external_user_id.to_string()),
            None,
            Some(display_name),
            None,
        );

        let result = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut conn)
            .await?;

        Self::apply_admin_privileges(db, external_user_id, project_roles).await?;

        Ok(result.id)
    }

    pub async fn apply_admin_privileges(
        _db: &crate::db::Db,
        _external_user_id: &str,
        _project_roles: Option<HashMap<String, HashMap<String, String>>>,
    ) -> Result<(), FilezError> {
        let config = get_current_config_cloned!(config());
        if config.enable_dev {}
        Ok(())
    }

    pub async fn get_many_by_id(
        db: &crate::db::Db,
        user_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, FilezUser>, FilezError> {
        let mut conn = db.pool.get().await?;

        let users: Vec<FilezUser> = schema::users::table
            .filter(schema::users::id.eq_any(user_ids))
            .load(&mut conn)
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
        let mut conn = db.pool.get().await?;

        match &external_user.user_id {
            Some(_) => {
                if let Some(impersonation_user_id) = request_headers
                    .get("X-Filez-Impersonate-User-Id")
                    .and_then(|v| v.to_str().ok())
                {
                    if let Some(project_roles) = &external_user.project_roles {
                        if project_roles.contains_key("admin") {
                            let result = schema::users::table
                                .filter(schema::users::external_user_id.eq(impersonation_user_id))
                                .first::<FilezUser>(&mut conn)
                                .await?;

                            debug!(
                                "User with external_user_id `{}` is impersonating user with ID `{}`",
                                external_user.user_id.clone().unwrap(),
                                impersonation_user_id
                            );
                            return Ok(result);
                        }
                    }
                    warn!(
                        "User with external_user_id `{}` tried to impersonate user with ID `{}`!",
                        external_user.user_id.clone().unwrap(),
                        impersonation_user_id
                    );
                    return Err(FilezError::Unauthorized(
                        "Impersonation is not allowed for this user".to_string(),
                    ));
                } else {
                    let result = schema::users::table
                        .filter(schema::users::external_user_id.eq(external_user.user_id.clone()))
                        .first::<FilezUser>(&mut conn)
                        .await?;
                    Ok(result)
                }
            }
            None => {
                // TODO: Handle case where external_user.user_id is None, we then parse some header to determine if the request is allowed by another user for some access key to allow "anonymous" uploads or similar
                return Err(FilezError::Unauthorized(
                    "User could not be determined from request headers".to_string(),
                ));
            }
        }
    }
}
