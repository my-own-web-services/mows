use std::{collections::HashMap, str::FromStr};

use bigdecimal::BigDecimal;
use diesel::{insert_into, prelude::*};
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::RunQueryDsl;
use mows_common_rust::get_current_config_cloned;
use url::Url;
use uuid::Uuid;

use crate::{
    api::files::info::update::UpdateFilesInfoTypeTagsMethod,
    auth::check::{check_resources_access_control, AuthEvaluation},
    config::config,
    errors::FilezErrors,
    models::{File, FileTagMember, FilezApp, Tag, User},
    schema::{self, files},
    utils::is_dev_origin,
};

#[derive(Clone)]
pub struct Db {
    pub pool: Pool<diesel_async::AsyncPgConnection>,
}

impl Db {
    pub async fn new(pool: Pool<diesel_async::AsyncPgConnection>) -> Self {
        Self { pool }
    }

    pub async fn get_files_metadata(&self, file_ids: &Vec<Uuid>) -> Result<Vec<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::id.eq_any(file_ids))
            .select(File::as_select())
            .load::<File>(&mut conn)
            .await?;

        Ok(result)
    }

    pub async fn get_file_by_id(&self, file_id: uuid::Uuid) -> Result<Option<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::id.eq(file_id))
            .select(File::as_select())
            .first::<File>(&mut conn)
            .await
            .optional()?;

        Ok(result)
    }

    pub async fn create_file(&self, new_file: &File) -> Result<File, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = diesel::insert_into(files::table)
            .values(new_file)
            .returning(File::as_returning())
            .get_result::<File>(&mut conn)
            .await?;

        Ok(result)
    }

    pub async fn get_user_by_external_id(
        &self,
        external_user_id: &str,
    ) -> Result<Option<User>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<User>(&mut conn)
            .await
            .optional()?;

        Ok(result)
    }

    pub async fn apply_user(
        &self,
        external_user_id: &str,
        display_name: &str,
    ) -> Result<uuid::Uuid, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let config = get_current_config_cloned!(config());

        // Check if the user already exists
        let existing_user = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<User>(&mut conn)
            .await
            .optional()?;

        if let Some(user) = existing_user {
            // update the existing users display name
            diesel::update(schema::users::table.find(user.id))
                .set(schema::users::display_name.eq(display_name))
                .execute(&mut conn)
                .await?;
            return Ok(user.id);
        };
        // If the user does not exist, create a new user
        let new_user = User::new(
            Some(external_user_id.to_string()),
            display_name,
            config.default_storage_limit,
        );

        let result = diesel::insert_into(schema::users::table)
            .values(&new_user)
            .get_result::<User>(&mut conn)
            .await?;
        Ok(result.id)
    }

    pub async fn delete_file(&self, file_id: uuid::Uuid) -> Result<(), FilezErrors> {
        let mut conn = self.pool.get().await?;

        diesel::delete(files::table.filter(files::id.eq(file_id)))
            .execute(&mut conn)
            .await?;

        Ok(())
    }

    pub async fn get_health(&self) -> Result<(), FilezErrors> {
        let mut conn = self.pool.get().await?;
        diesel::select(diesel::dsl::sql::<diesel::sql_types::Bool>("1 = 1"))
            .get_result::<bool>(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_users_user_groups(&self, user_id: &Uuid) -> Result<Vec<Uuid>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let user_groups = schema::user_user_group_members::table
            .filter(schema::user_user_group_members::user_id.eq(user_id))
            .select(schema::user_user_group_members::user_group_id)
            .load::<Uuid>(&mut conn)
            .await?;

        Ok(user_groups)
    }

    pub async fn check_resources_access_control(
        &self,
        requesting_user_id: &Uuid,
        requesting_app_id: &Uuid,
        requesting_app_trusted: bool,
        resource_type: &str,
        requested_resource_ids: &[Uuid],
        action: &str,
    ) -> Result<(bool, Vec<AuthEvaluation>), FilezErrors> {
        let user_group_ids = self.get_users_user_groups(requesting_user_id).await?;

        check_resources_access_control(
            self,
            requesting_user_id,
            &user_group_ids,
            requesting_app_id,
            requesting_app_trusted,
            resource_type,
            requested_resource_ids,
            action,
        )
        .await
    }

    pub async fn get_user_used_storage(&self, user_id: &Uuid) -> Result<BigDecimal, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let used_storage = schema::files::table
            .filter(schema::files::owner_id.eq(user_id))
            .select(diesel::dsl::sum(schema::files::size))
            .first::<Option<BigDecimal>>(&mut conn)
            .await?
            .unwrap_or_else(|| BigDecimal::from(0));

        Ok(used_storage)
    }

    pub async fn update_files_tags(
        &self,
        file_ids: &[Uuid],
        tags: &HashMap<String, String>,
        method: &UpdateFilesInfoTypeTagsMethod,
        created_by_user_id: &Uuid,
    ) -> Result<(), FilezErrors> {
        let mut conn = self.pool.get().await?;

        // tags are stored in the tags table and linked to files via file_tag_members

        match method {
            UpdateFilesInfoTypeTagsMethod::Add => {
                let tags_to_insert = tags
                    .iter()
                    .map(|(key, value)| Tag::new(key, value))
                    .collect::<Vec<Tag>>();
                insert_into(schema::tags::table)
                    .values(tags_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;
                // get the uuids of all the tags that were inserted or already existed
                let database_tags: Vec<Tag> = schema::tags::table
                    .filter(schema::tags::key.eq_any(tags.keys()))
                    .filter(schema::tags::value.eq_any(tags.values()))
                    .load(&mut conn)
                    .await?;
                // insert the file_tag_members
                let file_tag_members: Vec<FileTagMember> = database_tags
                    .iter()
                    .flat_map(|tag| {
                        file_ids.iter().map(|file_id| {
                            FileTagMember::new(*file_id, tag.id, *created_by_user_id)
                        })
                    })
                    .collect();

                insert_into(schema::file_tag_members::table)
                    .values(file_tag_members)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;
            }
            UpdateFilesInfoTypeTagsMethod::Remove => {
                // remove the tags from the file_tag_members
                diesel::delete(schema::file_tag_members::table)
                    .filter(schema::file_tag_members::file_id.eq_any(file_ids))
                    .filter(
                        schema::file_tag_members::tag_id.eq_any(
                            schema::tags::table
                                .filter(schema::tags::key.eq_any(tags.keys()))
                                .filter(schema::tags::value.eq_any(tags.values()))
                                .select(schema::tags::id),
                        ),
                    )
                    .execute(&mut conn)
                    .await?;
            }
            UpdateFilesInfoTypeTagsMethod::Set => {
                // first, remove all existing tags for the files
                diesel::delete(schema::file_tag_members::table)
                    .filter(schema::file_tag_members::file_id.eq_any(file_ids))
                    .execute(&mut conn)
                    .await?;

                // then, insert the new tags
                let tags_to_insert = tags
                    .iter()
                    .map(|(key, value)| Tag::new(key, value))
                    .collect::<Vec<Tag>>();

                insert_into(schema::tags::table)
                    .values(tags_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;

                // get the uuids of all the tags that were inserted or already existed
                let database_tags: Vec<Tag> = schema::tags::table
                    .filter(schema::tags::key.eq_any(tags.keys()))
                    .filter(schema::tags::value.eq_any(tags.values()))
                    .load(&mut conn)
                    .await?;

                // insert the file_tag_members
                let file_tag_members: Vec<FileTagMember> = database_tags
                    .iter()
                    .flat_map(|tag| {
                        file_ids.iter().map(|file_id| {
                            FileTagMember::new(*file_id, tag.id, *created_by_user_id)
                        })
                    })
                    .collect();

                insert_into(schema::file_tag_members::table)
                    .values(file_tag_members)
                    .execute(&mut conn)
                    .await?;
            }
        }

        Ok(())
    }

    pub async fn get_app_by_origin(&self, origin: &str) -> Result<FilezApp, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let apps = schema::apps::table
            .filter(schema::apps::origins.contains(vec![origin.to_string()]))
            .select(FilezApp::as_select())
            .load::<FilezApp>(&mut conn)
            .await?;

        if apps.is_empty() {
            return Err(FilezErrors::AuthEvaluationError(format!(
                "No app found for origin: {}",
                origin
            )));
        }
        if apps.len() > 1 {
            return Err(FilezErrors::AuthEvaluationError(format!(
                "Multiple apps found for origin: {}",
                origin
            )));
        }
        let app = apps.into_iter().next().unwrap();

        Ok(app)
    }

    pub async fn get_app_from_headers(
        &self,
        request_headers: &axum::http::HeaderMap,
    ) -> Result<FilezApp, FilezErrors> {
        match request_headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
        {
            Some(origin) => {
                let config = get_current_config_cloned!(config());
                if Url::from_str(&origin)? == config.primary_origin {
                    return Ok(FilezApp::first_party());
                } else if let Some(dev_origin) = is_dev_origin(&config, &origin).await {
                    return Ok(FilezApp::dev(&dev_origin));
                }
                self.get_app_by_origin(&origin).await
            }
            None => Ok(FilezApp::no_origin()),
        }
    }
}
