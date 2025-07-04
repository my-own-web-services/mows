use crate::{
    api::files::meta::update::UpdateFilesMetaTypeTagsMethod,
    auth::check::{check_resources_access_control, AuthResult},
    config::{config, FilezServerConfig},
    errors::FilezError,
    models::{file_tag_members::FileTagMember, files::FilezFile, tags::Tag, users::FilezUser},
    schema::{self, files},
    types::SortOrder,
};
use anyhow::Context;
use bigdecimal::BigDecimal;
use diesel::{insert_into, prelude::*};
use diesel_async::{
    async_connection_wrapper::AsyncConnectionWrapper, AsyncConnection, RunQueryDsl,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use mows_common_rust::get_current_config_cloned;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone)]
pub struct Db {
    pub pool: Pool<diesel_async::AsyncPgConnection>,
}

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

impl Db {
    pub async fn new(pool: Pool<diesel_async::AsyncPgConnection>) -> Self {
        Self { pool }
    }

    pub async fn run_migrations(config: &FilezServerConfig) -> Result<(), FilezError> {
        match AsyncPgConnection::establish(&config.db_url)
            .await
            .context("Failed to establish async Postgres connection")
        {
            Ok(async_connection) => {
                let mut async_wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
                    AsyncConnectionWrapper::from(async_connection);

                tokio::task::spawn_blocking(move || {
                    async_wrapper.run_pending_migrations(MIGRATIONS).unwrap();
                })
                .await
                .context("Failed to run pending migrations")?;
            }
            Err(e) => {
                tracing::error!("Failed to establish async Postgres connection: {e}");
            }
        };
        Ok(())
    }

    pub async fn get_file_group_item_count(&self, file_group_id: &Uuid) -> Result<i64, FilezError> {
        let mut conn = self.pool.get().await?;

        let count = schema::file_file_group_members::table
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .count()
            .get_result::<i64>(&mut conn)
            .await?;

        Ok(count)
    }

    pub async fn list_files_by_file_group(
        &self,
        file_group_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<&str>,
        sort_order: Option<SortOrder>,
    ) -> Result<Vec<FilezFile>, FilezError> {
        let mut conn = self.pool.get().await?;

        let mut query = schema::file_file_group_members::table
            .inner_join(files::table.on(schema::file_file_group_members::file_id.eq(files::id)))
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .select(FilezFile::as_select())
            .into_boxed();

        match (sort_by, sort_order) {
            (Some("created_time"), Some(SortOrder::Ascending)) => {
                query = query.order_by(files::created_time.asc());
            }
            (Some("created_time"), Some(SortOrder::Descending)) => {
                query = query.order_by(files::created_time.desc());
            }
            (Some("name"), Some(SortOrder::Ascending)) => {
                query = query.order_by(files::name.asc());
            }
            (Some("name"), Some(SortOrder::Descending)) => {
                query = query.order_by(files::name.desc());
            }
            _ => {
                query = query.order_by(files::created_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }
        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let files_list = query.load::<FilezFile>(&mut conn).await?;

        Ok(files_list)
    }

    pub async fn get_files_metadata(
        &self,
        file_ids: &Vec<Uuid>,
    ) -> Result<HashMap<Uuid, FilezFile>, FilezError> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::id.eq_any(file_ids))
            .select(FilezFile::as_select())
            .load::<FilezFile>(&mut conn)
            .await?;

        let result: HashMap<Uuid, FilezFile> =
            result.into_iter().map(|file| (file.id, file)).collect();

        Ok(result)
    }

    pub async fn get_files_tags(
        &self,
        file_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, HashMap<String, String>>, FilezError> {
        let mut conn = self.pool.get().await?;

        let tags: Vec<(Uuid, String, String)> = schema::file_tag_members::table
            .inner_join(
                schema::tags::table.on(schema::file_tag_members::tag_id.eq(schema::tags::id)),
            )
            .filter(schema::file_tag_members::file_id.eq_any(file_ids))
            .select((
                schema::file_tag_members::file_id,
                schema::tags::key,
                schema::tags::value,
            ))
            .load(&mut conn)
            .await?;

        let mut file_tags: HashMap<Uuid, HashMap<String, String>> = HashMap::new();

        for (file_id, key, value) in tags {
            file_tags
                .entry(file_id)
                .or_insert_with(HashMap::new)
                .insert(key, value);
        }

        Ok(file_tags)
    }

    pub async fn get_user_by_external_id(
        &self,
        external_user_id: &str,
    ) -> Result<FilezUser, FilezError> {
        let mut conn = self.pool.get().await?;

        let result = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut conn)
            .await?;

        Ok(result)
    }

    pub async fn apply_user(
        &self,
        external_user_id: &str,
        display_name: &str,
    ) -> Result<uuid::Uuid, FilezError> {
        let mut conn = self.pool.get().await?;

        let config = get_current_config_cloned!(config());

        // Check if the user already exists
        let existing_user = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut conn)
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
        let new_user = FilezUser::new(
            Some(external_user_id.to_string()),
            display_name,
            config.default_storage_limit,
        );

        let result = diesel::insert_into(schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut conn)
            .await?;
        Ok(result.id)
    }

    pub async fn delete_file(&self, file_id: uuid::Uuid) -> Result<(), FilezError> {
        let mut conn = self.pool.get().await?;

        diesel::delete(files::table.filter(files::id.eq(file_id)))
            .execute(&mut conn)
            .await?;

        Ok(())
    }

    pub async fn get_health(&self) -> Result<(), FilezError> {
        let mut conn = self.pool.get().await?;
        diesel::select(diesel::dsl::sql::<diesel::sql_types::Bool>("1 = 1"))
            .get_result::<bool>(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_users_user_groups(&self, user_id: &Uuid) -> Result<Vec<Uuid>, FilezError> {
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
    ) -> Result<AuthResult, FilezError> {
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

    pub async fn get_user_used_storage(&self, user_id: &Uuid) -> Result<BigDecimal, FilezError> {
        let mut conn = self.pool.get().await?;

        todo!();
    }

    pub async fn update_files_tags(
        &self,
        file_ids: &[Uuid],
        tags: &HashMap<String, String>,
        method: &UpdateFilesMetaTypeTagsMethod,
        created_by_user_id: &Uuid,
    ) -> Result<(), FilezError> {
        let mut conn = self.pool.get().await?;

        // tags are stored in the tags table and linked to files via file_tag_members

        match method {
            UpdateFilesMetaTypeTagsMethod::Add => {
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
            UpdateFilesMetaTypeTagsMethod::Remove => {
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
            UpdateFilesMetaTypeTagsMethod::Set => {
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

    pub async fn get_users_by_ids(
        &self,
        user_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, FilezUser>, FilezError> {
        let mut conn = self.pool.get().await?;

        let users: Vec<FilezUser> = schema::users::table
            .filter(schema::users::id.eq_any(user_ids))
            .load(&mut conn)
            .await?;
        let user_map: HashMap<Uuid, FilezUser> =
            users.into_iter().map(|user| (user.id, user)).collect();
        Ok(user_map)
    }
}
