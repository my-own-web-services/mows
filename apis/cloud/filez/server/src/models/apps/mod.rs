use crate::{
    config::{config, SERVICE_ACCOUNT_TOKEN_HEADER_NAME},
    database::Database,
    errors::FilezError,
    utils::{get_current_timestamp, get_uuid, is_dev_origin, InvalidEnumType},
};
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    sql_types::SmallInt,
    ExpressionMethods, PgArrayExpressionMethods, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use k8s_openapi::api::authentication::v1::TokenReview;
use mows_common_rust::get_current_config_cloned;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tracing::debug;
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
/// # Backend Apps
/// Pods can authenticate as apps using their Kubernetes service account token
/// Backend apps can act on behalf of users by picking up jobs created by users
/// # Frontend Apps
/// Frontend Apps are recognized by their origin that is sent with the browser request
/// They can act on behalf of users if an access policy allows it
pub struct MowsApp {
    /// Unique identifier for the app in the database, this is used to identify the app in all database operations
    pub id: Uuid,
    /// Name and Namespace of the app in Kubernetes
    /// Renaming an app in Kubernetes will not change the name in the database but create a new app with the new name
    /// Generally the name should not be changed, if it is it can be manually adjusted in the database
    pub name: String,
    pub description: Option<String>,
    /// If a app is marked as trusted, it can access all resources without any restrictions
    pub trusted: bool,
    /// Origins are used to identify the app in the browser, all origins must be unique across all apps
    /// If an app has no origins, it is considered a backend app
    pub origins: Option<Vec<String>>,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,

    pub app_type: AppType,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
    AsExpression,
    FromSqlRow,
    JsonSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AppType {
    #[serde(rename = "Frontend")]
    Frontend = 0,
    #[serde(rename = "Backend")]
    Backend = 1,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
pub struct MowsAppConfig {
    pub description: Option<String>,
    pub trusted: bool,
    pub origins: Option<Vec<String>>,
    pub app_type: AppType,
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
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            app_type: AppType::Frontend,
        }
    }
    pub fn dev(dev_origin: &Url) -> Self {
        Self {
            id: Uuid::nil(),
            name: "Filez Dev App".to_string(),
            description: Some("Development allowed filez app".to_string()),
            origins: Some(vec![dev_origin.to_string()]),
            trusted: true,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            app_type: AppType::Frontend,
        }
    }

    pub fn no_origin() -> Self {
        Self {
            id: Uuid::nil(),
            name: "Filez App with no origin".to_string(),
            description: Some("App with no origins".to_string()),
            origins: None,
            trusted: true,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            app_type: AppType::Frontend,
        }
    }

    pub async fn delete(database: &Database, name: &str) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(crate::schema::apps::table)
            .filter(crate::schema::apps::name.eq(name))
            .execute(&mut connection)
            .await?;

        Ok(())
    }
    pub async fn create_filez_server_app(database: &Database) -> Result<MowsApp, FilezError> {
        let app_id = Uuid::nil();
        let mut connection = database.get_connection().await?;
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
                    created_time: get_current_timestamp(),
                    modified_time: get_current_timestamp(),
                    app_type: AppType::Frontend,
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
        database: &Database,
        request_headers: &axum::http::HeaderMap,
    ) -> Result<MowsApp, FilezError> {
        match request_headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
        {
            Some(origin) => Self::get_from_origin_string(database, &origin).await,
            None => match request_headers
                .get(SERVICE_ACCOUNT_TOKEN_HEADER_NAME)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
            {
                Some(token) => {
                    Self::verify_kubernetes_service_account_token(database, &token).await
                }
                None => Ok(MowsApp::no_origin()),
            },
        }
    }

    async fn verify_kubernetes_service_account_token(
        database: &Database,
        token: &str,
    ) -> Result<MowsApp, FilezError> {
        let kubernetes_client = kube::Client::try_default().await?;
        let token_review_api = kube::api::Api::<TokenReview>::all(kubernetes_client);

        let token_review = TokenReview {
            metadata: kube::api::ObjectMeta {
                name: Some("filez-token-review".to_string()),
                ..Default::default()
            },
            spec: k8s_openapi::api::authentication::v1::TokenReviewSpec {
                token: Some(token.to_string()),
                ..Default::default()
            },
            status: None,
        };
        let response = token_review_api
            .create(&kube::api::PostParams::default(), &token_review)
            .await?;

        if let Some(user) = response.status.and_then(|s| s.user) {
            debug!(
                "Kubernetes service account token verified for user: {:?}",
                user.username
            );

            let username = user.username.ok_or(FilezError::Unauthorized(
                "Invalid service account token".to_string(),
            ))?;
            let mut connection = database.get_connection().await?;

            let app = crate::schema::apps::table
                .filter(crate::schema::apps::name.eq(username))
                .select(MowsApp::as_select())
                .first::<MowsApp>(&mut connection)
                .await?;

            if app.origins.is_some() || app.app_type != AppType::Backend {
                return Err(FilezError::Unauthorized(
                    "Service account token cannot be used for frontend apps".to_string(),
                ));
            }

            Ok(app)
        } else {
            Err(FilezError::Unauthorized(
                "Invalid service account token".to_string(),
            ))
        }
    }

    pub async fn get_from_origin_string(
        database: &Database,
        origin: &str,
    ) -> Result<MowsApp, FilezError> {
        debug!("Getting app from origin string: {}", origin);
        let config = get_current_config_cloned!(config());

        let origin_url = Url::from_str(&origin)?;

        if origin_url == config.primary_origin {
            return Ok(MowsApp::first_party().await);
        } else if let Some(dev_origin) = is_dev_origin(&config, &origin_url).await {
            return Ok(MowsApp::dev(&dev_origin));
        }
        let app = MowsApp::get_app_by_origin(database, &origin_url).await?;
        Ok(app)
    }

    pub async fn get_app_by_origin(
        database: &Database,
        origin: &Url,
    ) -> Result<MowsApp, FilezError> {
        debug!("Getting app by origin from database: {}", origin);

        let mut connection = database.get_connection().await?;

        let app = crate::schema::apps::table
            .filter(crate::schema::apps::origins.contains(vec![origin.to_string()]))
            .select(MowsApp::as_select())
            .first::<MowsApp>(&mut connection)
            .await?;

        Ok(app)
    }

    pub async fn create_or_update(
        database: &Database,
        app_config: &MowsAppConfig,
        full_name: &str,
    ) -> Result<MowsApp, FilezError> {
        let mut connection = database.get_connection().await?;

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

                app.modified_time = get_current_timestamp();

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
                    created_time: get_current_timestamp(),
                    modified_time: get_current_timestamp(),
                    app_type: app_config.app_type,
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
