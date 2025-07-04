use crate::{config::config, utils::is_dev_origin};
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    PgArrayExpressionMethods, Selectable, SelectableHelper,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use errors::FilezAppError;
use mows_common_rust::get_current_config_cloned;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, str::FromStr, sync::Arc};
use tokio::sync::RwLock;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

pub mod errors;

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
)]
#[diesel(table_name = crate::schema::apps)]
#[diesel(check_for_backend(Pg))]
pub struct MowsApp {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub trusted: bool,
    pub origins: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
pub struct MowsAppConfig {
    pub name: String,
    pub description: Option<String>,
    pub trusted: bool,
    pub origins: Option<Vec<String>>,
}

impl MowsApp {
    pub async fn first_party() -> Self {
        let config = get_current_config_cloned!(config());
        Self {
            id: Uuid::default(),
            name: "The Filez primary origin".to_string(),
            description: Some("First party app for Filez".to_string()),
            origins: Some(vec![config.primary_origin.to_string()]),
            trusted: true,
        }
    }
    pub fn dev(dev_origin: &Url) -> Self {
        Self {
            id: Uuid::default(),
            name: "Filez Dev App".to_string(),
            description: Some("Development allowed filez app".to_string()),
            origins: Some(vec![dev_origin.to_string()]),
            trusted: true,
        }
    }

    pub fn no_origin() -> Self {
        Self {
            id: Uuid::default(),
            name: "Filez App with no origin".to_string(),
            description: Some("App with no origins".to_string()),
            origins: None,
            trusted: true,
        }
    }

    pub async fn get_from_headers(
        db: &crate::db::Db,
        request_headers: &axum::http::HeaderMap,
    ) -> Result<MowsApp, FilezAppError> {
        match request_headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
        {
            Some(origin) => {
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
            None => Ok(MowsApp::no_origin()),
        }
    }

    pub async fn get_app_by_origin(
        db: &crate::db::Db,
        origin: &Url,
    ) -> Result<MowsApp, FilezAppError> {
        let mut connection = db.pool.get().await?;

        let app = crate::schema::apps::table
            .filter(crate::schema::apps::origins.contains(vec![origin.to_string()]))
            .select(MowsApp::as_select())
            .first::<MowsApp>(&mut connection)
            .await?;

        Ok(app)
    }
}
