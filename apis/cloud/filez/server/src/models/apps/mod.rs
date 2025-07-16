use crate::{
    config::config,
    errors::FilezError,
    utils::{get_uuid, is_dev_origin},
};
use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, PgArrayExpressionMethods, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use mows_common_rust::get_current_config_cloned;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize,
    Deserialize,
    Queryable,
    Selectable,
    ToSchema,
    Insertable,
    Clone,
    QueryableByName,
    Debug,
    AsChangeset,
)]
#[diesel(table_name = crate::schema::apps)]
#[diesel(check_for_backend(Pg))]
pub struct MowsApp {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub trusted: bool,
    pub origins: Option<Vec<String>>,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
pub struct MowsAppConfig {
    pub description: Option<String>,
    pub trusted: bool,
    pub origins: Option<Vec<String>>,
}

impl MowsApp {
    pub async fn first_party() -> Self {
        let config = get_current_config_cloned!(config());
        Self {
            id: Uuid::nil(),
            name: "The Filez primary origin".to_string(),
            description: Some("First party app for Filez".to_string()),
            origins: Some(vec![config.primary_origin.to_string()]),
            trusted: true,
            created_time: chrono::Local::now().naive_local(),
            modified_time: chrono::Local::now().naive_local(),
        }
    }
    pub fn dev(dev_origin: &Url) -> Self {
        Self {
            id: Uuid::nil(),
            name: "Filez Dev App".to_string(),
            description: Some("Development allowed filez app".to_string()),
            origins: Some(vec![dev_origin.to_string()]),
            trusted: true,
            created_time: chrono::Local::now().naive_local(),
            modified_time: chrono::Local::now().naive_local(),
        }
    }

    pub fn no_origin() -> Self {
        Self {
            id: Uuid::nil(),
            name: "Filez App with no origin".to_string(),
            description: Some("App with no origins".to_string()),
            origins: None,
            trusted: true,
            created_time: chrono::Local::now().naive_local(),
            modified_time: chrono::Local::now().naive_local(),
        }
    }

    pub async fn delete(db: &crate::db::Db, name: &str) -> Result<(), FilezError> {
        let mut connection = db.pool.get().await?;
        diesel::delete(crate::schema::apps::table)
            .filter(crate::schema::apps::name.eq(name))
            .execute(&mut connection)
            .await?;

        Ok(())
    }
    pub async fn create_filez_server_app(db: &crate::db::Db) -> Result<MowsApp, FilezError> {
        let app_id = Uuid::nil();
        let mut connection = db.pool.get().await?;
        let existing_app = crate::schema::apps::table
            .filter(crate::schema::apps::id.eq(app_id))
            .select(MowsApp::as_select())
            .first::<MowsApp>(&mut connection)
            .await
            .ok();

        match existing_app {
            Some(app) => Ok(app),
            None => {
                let config = get_current_config_cloned!(config());
                let new_app = MowsApp {
                    id: app_id,
                    name: "Filez Server App".to_string(),
                    description: Some("Filez server app for first party requests".to_string()),
                    trusted: true,
                    origins: Some(vec![config.primary_origin.to_string()]),
                    created_time: chrono::Local::now().naive_local(),
                    modified_time: chrono::Local::now().naive_local(),
                };

                diesel::insert_into(crate::schema::apps::table)
                    .values(&new_app)
                    .execute(&mut connection)
                    .await?;

                Ok(new_app)
            }
        }
    }

    pub async fn get_from_headers(
        db: &crate::db::Db,
        request_headers: &axum::http::HeaderMap,
    ) -> Result<MowsApp, FilezError> {
        match request_headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
        {
            Some(origin) => Self::get_from_origin_string(db, &origin).await,
            None => Ok(MowsApp::no_origin()),
        }
    }

    pub async fn get_from_origin_string(
        db: &crate::db::Db,
        origin: &str,
    ) -> Result<MowsApp, FilezError> {
        let config = get_current_config_cloned!(config());

        let origin_url = Url::from_str(&origin)?;

        if origin_url == config.primary_origin {
            return Ok(MowsApp::first_party().await);
        } else if let Some(dev_origin) = is_dev_origin(&config, &origin_url).await {
            return Ok(MowsApp::dev(&dev_origin));
        }
        let app = MowsApp::get_app_by_origin(db, &origin_url).await?;
        Ok(app)
    }

    pub async fn get_app_by_origin(
        db: &crate::db::Db,
        origin: &Url,
    ) -> Result<MowsApp, FilezError> {
        let mut connection = db.pool.get().await?;

        let app = crate::schema::apps::table
            .filter(crate::schema::apps::origins.contains(vec![origin.to_string()]))
            .select(MowsApp::as_select())
            .first::<MowsApp>(&mut connection)
            .await?;

        Ok(app)
    }

    pub async fn create_or_update(
        db: &crate::db::Db,
        app_config: &MowsAppConfig,
        full_name: &str,
    ) -> Result<MowsApp, FilezError> {
        let mut connection = db.pool.get().await?;

        let existing_app = crate::schema::apps::table
            .filter(crate::schema::apps::name.eq(&full_name))
            .select(MowsApp::as_select())
            .first::<MowsApp>(&mut connection)
            .await
            .ok();

        match existing_app {
            Some(mut app) => {
                app.description = app_config.description.clone();
                app.trusted = app_config.trusted;
                app.origins = app_config.origins.clone();

                app.modified_time = chrono::Local::now().naive_local();

                // filter
                diesel::update(crate::schema::apps::table)
                    .filter(crate::schema::apps::id.eq(app.id))
                    .set(&app)
                    .execute(&mut connection)
                    .await?;

                Ok(app)
            }
            None => {
                let new_app = MowsApp {
                    id: get_uuid(),
                    name: full_name.to_string(),
                    description: app_config.description.clone(),
                    trusted: app_config.trusted,
                    origins: app_config.origins.clone(),
                    created_time: chrono::Local::now().naive_local(),
                    modified_time: chrono::Local::now().naive_local(),
                };

                diesel::insert_into(crate::schema::apps::table)
                    .values(&new_app)
                    .execute(&mut connection)
                    .await?;

                Ok(new_app)
            }
        }
    }
}
