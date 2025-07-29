use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::openapi::{schema::SchemaType, OpenApi, RefOr, Schema, Type};

use crate::{
    openapi_client_generator::{ClientGeneratorError, VirtualFileSystem},
    s,
};

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
        self.generate_and_write_cargo_toml().await?;
        self.generate_and_write_lib_rs().await?;
        self.generate_and_write_types().await?;
        self.generate_and_write_client().await?;
        Ok(self.vfs.clone())
    }
    pub async fn generate_and_write_cargo_toml(&mut self) -> Result<(), ClientGeneratorError> {
        let title = self.spec.info.title.clone();
        let version = self.spec.info.version.clone();
        let cargo_toml_content = format!(
            r#"[package]
name = "{title}-client"
version = "{version}"
edition = "2021"

[lib]

[dependencies]
reqwest = {{ workspace = true, features = ["json"] }}
serde = {{ workspace = true, features = ["derive"] }}
serde_json = {{ workspace = true }}
tokio = {{ workspace = true, features = ["full"] }}
"#,
        );
        self.vfs.insert("Cargo.toml", cargo_toml_content);
        Ok(())
    }

    pub async fn generate_and_write_lib_rs(&mut self) -> Result<(), ClientGeneratorError> {
        let lib_rs_content = r#"pub mod types;
pub mod client;
"#;
        self.vfs.insert("src/lib.rs", lib_rs_content.to_string());
        Ok(())
    }

    pub async fn generate_and_write_client(&mut self) -> Result<(), ClientGeneratorError> {
        let client_content = r#"use reqwest::Client;
use crate::types::*;

#[derive(Debug, Clone)]
pub struct ApiClient {
    pub client: Client,
    pub base_url: String,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::new();
        Self { client, base_url }
    }
}"#;
        self.vfs.insert("src/client.rs", client_content.to_string());
        Ok(())
    }

    pub async fn generate_and_write_types(&mut self) -> Result<(), ClientGeneratorError> {
        let mut types = Vec::new();

        if let Some(components) = &self.spec.components {
            for (name, schema) in &components.schemas {
                let rust_type = self.schema_to_rust_type(name, schema).await?;
                types.push(rust_type);
            }
        }

        let types_content = format!(
            r#"// This file is auto-generated from OpenAPI specification
use serde::{{Deserialize, Serialize}};
use serde_json::Value;

{}
"#,
            types.join("\n\n")
        );

        self.vfs.insert("src/types.rs", types_content);

        Ok(())
    }

    pub async fn schema_to_rust_type(
        &self,
        name: &str,
        schema: &RefOr<Schema>,
    ) -> Result<String, ClientGeneratorError> {
        Ok(match schema {
            RefOr::Ref(reference) => reference
                .ref_location
                .split('/')
                .last()
                .ok_or(ClientGeneratorError::GenerationError(
                    "Failed to extract type name from reference".to_string(),
                ))?
                .to_string(),
            RefOr::T(schema_obj) => match &schema_obj {
                Schema::Array(array) => "".to_string(),
                Schema::Object(object) => match (&object.schema_type, &object.enum_values) {
                    (SchemaType::Type(Type::String), Some(enum_values)) => {
                        let enum_variants = enum_values
                            .iter()
                            .map(|value| match value {
                                Value::String(s) => s.replace('-', "_").replace(' ', "_"),
                                _ => {
                                    todo!()
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(",\n    ");

                        format!(
                            r#"#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum {name} {{
    {enum_variants}
}}"#,
                            name = name,
                            enum_variants = enum_variants
                        )
                    }
                    _ => "".to_string(),
                },
                Schema::OneOf(one_of) => "".to_string(),
                Schema::AllOf(all_of) => "".to_string(),
                Schema::AnyOf(any_of) => "".to_string(),
                _ => {
                    return Err(ClientGeneratorError::GenerationError(
                        "Unsupported schema type".to_string(),
                    ))
                }
            },
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RustGeneratorConfig {}
