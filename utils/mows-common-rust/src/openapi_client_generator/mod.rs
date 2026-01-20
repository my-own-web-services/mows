use crate::openapi_client_generator::generators::{rust::RustGenerator, GeneratorType};
use std::{collections::HashMap, path::Path};
use utoipa::openapi::OpenApi;

pub mod generators;

pub async fn generate_openapi_client(
    openapi_path: &Path,
    generator_type: GeneratorType,
) -> Result<VirtualFileSystem, ClientGeneratorError> {
    let openapi_spec_string = tokio::fs::read_to_string(openapi_path).await?;
    let openapi_spec: OpenApi = match openapi_path.extension().and_then(|s| s.to_str()) {
        Some("json") => serde_json::from_str(&openapi_spec_string)?,
        Some("yaml") | Some("yml") => serde_yaml_neo::from_str(&openapi_spec_string)?,
        _ => {
            return Err(ClientGeneratorError::UnsupportedFileFormat(
                openapi_path
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
            ));
        }
    };

    match generator_type {
        GeneratorType::Rust(config) => RustGenerator::new(config, openapi_spec).generate().await,
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ClientGeneratorError {
    #[error("Failed to read OpenAPI specification: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse OpenAPI specification: {0}")]
    ParseError(#[from] serde_json::Error),

    #[error("Failed to parse OpenAPI specification: {0}")]
    ParseYamlError(#[from] serde_yaml_neo::Error),

    #[error("Failed to generate client: {0}")]
    GenerationError(String),

    #[error("Unsupported file format: {0}")]
    UnsupportedFileFormat(String),

    #[error("Missing operation ID for PathItem operation")]
    MissingOperationId,
}

#[derive(Debug, Clone, Default)]
pub struct VirtualFileSystem {
    pub content: HashMap<String, String>,
}

pub enum VirtualFileSystemContentType {}

impl VirtualFileSystem {
    pub fn new() -> Self {
        Self {
            content: HashMap::new(),
        }
    }
    pub fn insert(&mut self, path: &str, content: String) {
        self.content.insert(path.to_string(), content);
    }
    pub fn get(&self, path: &str) -> Option<&String> {
        self.content.get(path)
    }
    pub fn contains(&self, path: &str) -> bool {
        self.content.contains_key(path)
    }
    pub fn remove(&mut self, path: &str) -> Option<String> {
        self.content.remove(path)
    }

    pub async fn write_to_dir(
        &self,
        base_directory: &Path,
        replacement_strategy: WriteToDirectoryReplacementStrategy,
    ) -> Result<(), ClientGeneratorError> {
        if !base_directory.exists() {
            tokio::fs::create_dir_all(base_directory).await?;
        } else if !base_directory.is_dir() {
            return Err(ClientGeneratorError::GenerationError(
                "Base path is not a directory".to_string(),
            ));
        }

        match replacement_strategy {
            WriteToDirectoryReplacementStrategy::Replace => {
                tokio::fs::remove_dir_all(base_directory).await?;
                tokio::fs::create_dir_all(base_directory).await?;
            }
            WriteToDirectoryReplacementStrategy::WriteInto => {
                // Do nothing, just write into the existing directory
            }
            WriteToDirectoryReplacementStrategy::ErrorIfExists => {
                if !base_directory.read_dir()?.next().is_none() {
                    return Err(ClientGeneratorError::GenerationError(
                        "Base dir is not empty".to_string(),
                    ));
                }
            }
        }

        for (path, content) in &self.content {
            let full_path = base_directory.join(path);
            if let Some(parent) = full_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            tokio::fs::write(full_path, content).await?;
        }
        Ok(())
    }
}

pub enum WriteToDirectoryReplacementStrategy {
    Replace,
    WriteInto,
    ErrorIfExists,
}
