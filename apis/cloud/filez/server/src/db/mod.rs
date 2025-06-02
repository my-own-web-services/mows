use diesel::prelude::*;
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::{
    api::files::get_metadata::GetFilesMetaRequestBody,
    errors::FilezErrors,
    models::{File, NewFile, NewUser, User},
    schema::{self, files},
};

#[derive(Clone)]
pub struct Db {
    pool: Pool<diesel_async::AsyncPgConnection>,
}

impl Db {
    pub async fn new(pool: Pool<diesel_async::AsyncPgConnection>) -> Self {
        Self { pool }
    }

    pub async fn get_files_metadata_for_owner(
        &self,
        file_ids: &Vec<Uuid>,
        owner_id: Uuid,
    ) -> Result<Vec<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::file_id.eq_any(file_ids))
            .filter(files::owner_id.eq(owner_id))
            .select(File::as_select())
            .load::<File>(&mut conn)
            .await?;

        Ok(result)
    }

    pub async fn get_file_by_id_and_owner(
        &self,
        file_id: uuid::Uuid,
        owner_id: Uuid,
    ) -> Result<Option<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::file_id.eq(file_id))
            .filter(files::owner_id.eq(owner_id))
            .select(File::as_select())
            .first::<File>(&mut conn)
            .await
            .optional()?;

        Ok(result)
    }

    pub async fn create_file(&self, new_file: &NewFile<'_>) -> Result<File, FilezErrors> {
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

        // Check if the user already exists
        let existing_user = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<User>(&mut conn)
            .await
            .optional()?;

        if let Some(user) = existing_user {
            // update the existing users display name
            diesel::update(schema::users::table.find(user.user_id))
                .set(schema::users::display_name.eq(display_name))
                .execute(&mut conn)
                .await?;
            return Ok(user.user_id);
        };
        // If the user does not exist, create a new user
        let new_user = NewUser {
            external_user_id,
            display_name,
            created_time: chrono::Utc::now().naive_utc(),
        };

        let result = diesel::insert_into(schema::users::table)
            .values(&new_user)
            .get_result::<User>(&mut conn)
            .await?;
        Ok(result.user_id)
    }

    pub async fn delete_file(&self, file_id: uuid::Uuid) -> Result<(), FilezErrors> {
        let mut conn = self.pool.get().await?;

        diesel::delete(files::table.filter(files::file_id.eq(file_id)))
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
}
