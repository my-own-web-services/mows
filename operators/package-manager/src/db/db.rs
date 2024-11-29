use diesel::prelude::*;

use crate::errors::PackageManagerErrors;

use super::models::{NewRepository, Repository};

#[derive(Clone)]
pub struct Db {
    pool: deadpool_diesel::sqlite::Pool,
}

impl Db {
    pub async fn new(pool: deadpool_diesel::sqlite::Pool) -> Self {
        Self { pool }
    }

    pub async fn add_repository(
        self,
        repositories: Vec<NewRepository>,
    ) -> Result<usize, PackageManagerErrors> {
        use crate::db::schema::repositories;

        let res = self
            .pool
            .get()
            .await?
            .interact(move |conn| {
                diesel::insert_into(repositories::table)
                    .values(&repositories)
                    .execute(conn)
            })
            .await??;

        Ok(res)
    }

    pub async fn get_all_repositories(self) -> Result<Vec<Repository>, PackageManagerErrors> {
        use crate::db::schema::repositories::dsl::*;

        let repos = self
            .pool
            .get()
            .await?
            .interact(move |conn| {
                repositories
                    .select(Repository::as_select())
                    .load::<Repository>(conn)
            })
            .await??;

        Ok(repos)
    }
}
