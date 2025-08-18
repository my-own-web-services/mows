use crate::openapi_client_generator::{
    generators::rust::{
        client::{generate_client_function, get_operations},
        schema::ref_or_schema_to_rust_type,
    },
    ClientGeneratorError, VirtualFileSystem,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::openapi::OpenApi;

mod client;
mod schema;

pub struct RustGenerator {
    pub config: RustGeneratorConfig,
    pub spec: OpenApi,
    pub vfs: VirtualFileSystem,
}
impl RustGenerator {
    pub fn new(config: RustGeneratorConfig, spec: OpenApi) -> Self {
        let vfs = VirtualFileSystem::default();

        Self { config, spec, vfs }
    }
    pub async fn generate(&mut self) -> Result<VirtualFileSystem, ClientGeneratorError> {
        self.generate_and_write_cargo_toml()?;
        self.generate_and_write_lib_rs()?;
        self.generate_and_write_types()?;
        self.generate_and_write_client()?;
        self.generate_and_write_tests()?;
        Ok(self.vfs.clone())
    }
    fn generate_and_write_cargo_toml(&mut self) -> Result<(), ClientGeneratorError> {
        let title = self.spec.info.title.clone();
        let version = self.spec.info.version.clone();
        let cargo_toml_content = format!(
            r#"[package]
name = "{title}-client"
version = "{version}"
edition = "2021"

[lib]

[dependencies]
reqwest = {{  version = "0.12.22", features = ["json", "rustls-tls", "zstd", "stream"], default-features = false }}
serde = {{ version = "1.0.219", features = ["derive"] }}
serde_json = {{ version = "1.0.141" }}
tokio = {{ version = "1.47.0", features = ["full"] }}
uuid = {{ version = "1.17.0", features = ["serde", "v7"] }}
chrono = {{ version = "0.4.41", features = ["serde"] }}
thiserror = {{ version = "2.0.12" }}
tokio-util = {{ version = "0.7", features = ["codec"] }}
futures = "0.3"
reqwest-tracing = {{ version = "0.5.7", features = ["opentelemetry_0_28"] }}
reqwest-middleware = {{ version = "0.4.0", features = ["json", "rustls-tls"] }}
tracing= {{ version = "0.1.40", features = ["default"] }}
"#,
        );
        self.vfs.insert("Cargo.toml", cargo_toml_content);
        Ok(())
    }

    fn generate_and_write_lib_rs(&mut self) -> Result<(), ClientGeneratorError> {
        let lib_rs_content = r#"pub mod types;
pub mod client;
pub use reqwest;
pub use tokio_util;
pub use futures;
"#;
        self.vfs.insert("src/lib.rs", lib_rs_content.to_string());
        Ok(())
    }

    fn generate_and_write_client(&mut self) -> Result<(), ClientGeneratorError> {
        let mut functions = Vec::new();

        for (path, path_item) in self.spec.paths.paths.iter() {
            for (operation_method, operation_item) in get_operations(path_item)?.iter() {
                let function = generate_client_function(path, operation_method, operation_item)?;
                functions.push(function);
            }
        }

        let functions = functions
            .into_iter()
            .map(|f| f.to_string())
            .collect::<Vec<_>>()
            .join("\n\n    ");

        let client_content = format!(
            r#"use reqwest::Client;
use crate::types::*;
use uuid::Uuid;
use reqwest::Url;
use reqwest::header::HeaderMap;
use reqwest_middleware::{{ClientBuilder, ClientWithMiddleware}};
use reqwest_tracing::TracingMiddleware;



#[derive(Debug, Clone)]
pub struct ApiClient {{
    pub client: ClientWithMiddleware,
    pub base_url: String,
    pub impersonate_user: Option<Uuid>,
    pub auth_method: Option<AuthMethod>,
    pub runtime_instance_id: Option<String>,
}}

#[derive(Debug, Clone)]
pub enum AuthMethod {{
    ServiceAccountToken(String),
    ServiceAccountTokenPath(std::path::PathBuf),
    ServiceAccountTokenDefaultPath,
    BearerToken(String),
    KeyAccess((Uuid, String)),
}}


#[derive(Debug, thiserror::Error)]
pub enum ApiClientError {{
    #[error("Request error: {{0:?}}")]
    RequestError(#[from] reqwest::Error),
    #[error("Request with middleware error: {{0:?}}")]
    RequestWithMiddlewareError(#[from] reqwest_middleware::Error),
    #[error(transparent)]
    ParseError(#[from] serde_json::Error),
    #[error(transparent)]
    InvalidHeaderValue(#[from] reqwest::header::InvalidHeaderValue),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
    #[error("API error: {{0}}")]
    ApiError(String),
}}

impl ApiClient {{
    #[tracing::instrument]
    pub fn new(base_url: String, auth_method: Option<AuthMethod>, impersonate_user: Option<Uuid>, runtime_instance_id: Option<String>) -> Result<Self, ApiClientError> {{
        let client = reqwest::Client::builder()
            .user_agent(format!("filez-client-rust"))
            .build()?;

        let client = ClientBuilder::new(client)
            .with(TracingMiddleware::default())
            .build();
        let base_url = base_url.trim_end_matches('/').to_string();
        Ok(Self {{ client, base_url, auth_method, impersonate_user, runtime_instance_id }})
    }}
    
    #[tracing::instrument]
    fn add_auth_headers(&self) -> Result<HeaderMap, ApiClientError> {{
        let mut headers = HeaderMap::new();
        match &self.auth_method {{
            Some(auth_method) => match auth_method {{
                AuthMethod::ServiceAccountToken(service_account_token) => {{
                    headers.insert("x-service-account-token", service_account_token.parse()?);
                }}
                AuthMethod::ServiceAccountTokenPath(service_account_token_token_path) => {{
                    let service_account_token =
                        std::fs::read_to_string(service_account_token_token_path)?;
                    headers.insert(
                        "x-service-account-token",
                        service_account_token.trim().parse()?,
                    );
                }}
                AuthMethod::ServiceAccountTokenDefaultPath => {{
                    let service_account_token = std::fs::read_to_string(
                        "/var/run/secrets/kubernetes.io/serviceaccount/token",
                    )?;
                    headers.insert(
                        "x-service-account-token",
                        service_account_token.trim().parse()?,
                    );
                }}
                AuthMethod::BearerToken(bearer_token) => {{
                    headers.insert(
                        reqwest::header::AUTHORIZATION,
                        format!("Bearer {{}}", bearer_token).parse()?,
                    );
                }}
                AuthMethod::KeyAccess((user_id, token)) => {{
                    headers.insert(
                        "X-Filez-Key-Access",
                        format!("{{}}:{{}}", user_id, token).parse()?,
                    );
                }}
            }},
            None => {{}}
        }}

        if let Some(impersonate_user) = self.impersonate_user {{
            headers.insert(
                "X-Filez-Impersonate-User",
                impersonate_user.to_string().parse()?,
            );
        }}

        if let Some(runtime_instance_id) = &self.runtime_instance_id {{
            headers.insert(
                "X-Filez-Runtime-Instance-ID",
                runtime_instance_id.parse()?,
            );
        }}

        Ok(headers)
    }}



    {functions}
}}
    
    
struct OptionAsNull<T>(pub Option<T>);

impl<T: std::fmt::Display> std::fmt::Display for OptionAsNull<T> {{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{
        match &self.0 {{
            Some(value) => write!(f, "{{}}", value),
            None => write!(f, "null"),
        }}
    }}
}}
    
    "#
        );
        self.vfs.insert("src/client.rs", client_content.to_string());
        Ok(())
    }

    fn generate_and_write_tests(&mut self) -> Result<(), ClientGeneratorError> {
        let test_content = r#"#[cfg(test)]
mod tests {
    use filez_server_client::client::{ApiClient, AuthMethod};

    #[tokio::test]
    async fn test_api_client() {
        let client = ApiClient::new(
            "https://filez-server.vindelicorum.eu/".to_string(),
            None,
            None,
        );

        client.get_health().await.unwrap();
    }

}"#;
        self.vfs.insert("tests/client.rs", test_content.to_string());
        Ok(())
    }

    fn generate_and_write_types(&mut self) -> Result<(), ClientGeneratorError> {
        let mut types = HashMap::new();

        if let Some(components) = &self.spec.components {
            for (struct_name, schema) in &components.schemas {
                let rust_type =
                    ref_or_schema_to_rust_type(&mut types, Some(struct_name.to_string()), schema)?;
                types.insert(struct_name.to_string(), rust_type);
            }
        }

        let types_content = format!(
            r#"// This file is auto-generated from OpenAPI specification
use serde::{{Deserialize, Serialize}};
use serde_json::Value;
use uuid::Uuid;
use chrono::NaiveDateTime;
use std::collections::HashMap;

{}
"#,
            types
                .iter()
                .map(|(key, value)| format!(
                    r#"// {key}
{value}
"#
                ))
                .collect::<Vec<_>>()
                .join("\n\n")
        );

        self.vfs.insert("src/types.rs", types_content);

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RustGeneratorConfig {}
