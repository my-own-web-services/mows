use diesel::prelude::*;
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::RunQueryDsl;

use crate::{
    api::files::get_metadata::GetFilesMetaRequestBody, errors::FilezErrors, models::File,
    schema::files,
};

#[derive(Clone)]
pub struct Db {
    pool: Pool<diesel_async::AsyncPgConnection>,
}

impl Db {
    pub async fn new(pool: Pool<diesel_async::AsyncPgConnection>) -> Self {
        Self { pool }
    }

    pub async fn get_files_metadata(
        &self,
        request: &GetFilesMetaRequestBody,
    ) -> Result<Vec<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let file_ids = request.file_ids.clone();

        let result = files::table
            .filter(files::file_id.eq_any(file_ids))
            .load::<File>(&mut conn)
            .await?;

        Ok(result)
    }

    pub async fn get_file_by_id(&self, file_id: uuid::Uuid) -> Result<Option<File>, FilezErrors> {
        let mut conn = self.pool.get().await?;

        let result = files::table
            .filter(files::file_id.eq(file_id))
            .first::<File>(&mut conn)
            .await
            .optional()?;

        Ok(result)
    }
}
