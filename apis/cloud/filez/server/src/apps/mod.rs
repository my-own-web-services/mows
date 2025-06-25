use crate::{config::config, errors::FilezError, utils::is_dev_origin};
use mows_common_rust::get_current_config_cloned;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use url::Url;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Default, Debug, JsonSchema)]
pub struct FilezApp {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub origins: Option<Vec<String>>,
    pub trusted: bool,
}

impl FilezApp {
    pub fn first_party() -> Self {
        Self {
            id: "filez".to_string(),
            name: "The Filez primary origin".to_string(),
            description: Some("First party app for Filez".to_string()),
            origins: None,
            trusted: true,
        }
    }
    pub fn dev(dev_origin: &Url) -> Self {
        Self {
            id: "filez-dev".to_string(),
            name: "Filez Dev App".to_string(),
            description: Some("Development allowed filez app".to_string()),
            origins: Some(vec![dev_origin.to_string()]),
            trusted: true,
        }
    }

    pub fn no_origin() -> Self {
        Self {
            id: "filez-no-origin".to_string(),
            name: "Filez App with no origin".to_string(),
            description: Some("App with no origins".to_string()),
            origins: None,
            trusted: true,
        }
    }

    pub async fn get_app_from_headers(
        request_headers: &axum::http::HeaderMap,
    ) -> Result<FilezApp, FilezError> {
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
                FilezApp::get_app_by_origin(&origin).await
            }
            None => Ok(FilezApp::no_origin()),
        }
    }

    pub async fn get_app_by_origin(_origin: &str) -> Result<FilezApp, FilezError> {
        todo!();
    }
}
