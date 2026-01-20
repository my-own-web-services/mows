//! Error types for mpm.
//!
//! This module provides a unified error type for the entire application,
//! enabling proper error handling, context preservation, and pattern matching.

use std::path::PathBuf;
use thiserror::Error;

/// The main error type for mpm operations.
#[derive(Debug, Error)]
pub enum MpmError {
    /// I/O error with context about what operation failed.
    #[error("{context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },

    /// YAML parsing error.
    #[error("Failed to parse YAML in {path}: {source}")]
    YamlParse {
        path: String,
        #[source]
        source: serde_yaml::Error,
    },

    /// YAML serialization error.
    #[error("Failed to serialize YAML: {0}")]
    YamlSerialize(#[from] serde_yaml::Error),

    /// JSON parsing error.
    #[error("Failed to parse JSON: {0}")]
    JsonParse(#[source] serde_json::Error),

    /// JSON serialization error.
    #[error("Failed to serialize JSON: {0}")]
    JsonSerialize(#[source] serde_json::Error),

    /// TOML parsing error.
    #[error("Failed to parse TOML in {path}: {source}")]
    TomlParse {
        path: String,
        #[source]
        source: toml::de::Error,
    },

    /// Command execution error.
    #[error("Failed to execute {command}: {message}")]
    Command { command: String, message: String },

    /// Git operation error.
    #[error("Git error: {0}")]
    Git(String),

    /// Docker operation error.
    #[error("Docker error: {0}")]
    Docker(String),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    Config(String),

    /// Manifest error.
    #[error("Manifest error: {0}")]
    Manifest(String),

    /// Template rendering error.
    #[error("Template error: {0}")]
    Template(String),

    /// Template execution error from gtmpl.
    #[error("Template execution error: {0}")]
    TemplateExec(#[from] gtmpl_ng::ExecError),

    /// Path error (not found, invalid, traversal attempt).
    #[error("{message}: {path}")]
    Path { path: PathBuf, message: String },

    /// Validation error.
    #[error("Validation error: {0}")]
    Validation(String),

    /// Network/HTTP error.
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// jq query error.
    #[error("jq error: {0}")]
    Jq(String),

    /// User-facing error message (for simple cases).
    #[error("{0}")]
    Message(String),
}

/// Result type alias for mpm operations.
pub type Result<T> = std::result::Result<T, MpmError>;

impl MpmError {
    /// Create an I/O error with context.
    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }

    /// Create a path error.
    pub fn path(path: impl Into<PathBuf>, message: impl Into<String>) -> Self {
        Self::Path {
            path: path.into(),
            message: message.into(),
        }
    }

    /// Create a command error.
    pub fn command(command: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Command {
            command: command.into(),
            message: message.into(),
        }
    }

    /// Create a YAML parse error with path context.
    pub fn yaml_parse(path: impl Into<String>, source: serde_yaml::Error) -> Self {
        Self::YamlParse {
            path: path.into(),
            source,
        }
    }

    /// Create a TOML parse error with path context.
    pub fn toml_parse(path: impl Into<String>, source: toml::de::Error) -> Self {
        Self::TomlParse {
            path: path.into(),
            source,
        }
    }
}

/// Extension trait for adding context to I/O errors.
pub trait IoResultExt<T> {
    /// Add context to an I/O error.
    fn io_context(self, context: impl Into<String>) -> Result<T>;
}

impl<T> IoResultExt<T> for std::result::Result<T, std::io::Error> {
    fn io_context(self, context: impl Into<String>) -> Result<T> {
        self.map_err(|e| MpmError::io(context, e))
    }
}

/// Extension trait for adding path context to YAML errors.
pub trait YamlResultExt<T> {
    /// Add path context to a YAML parse error.
    fn yaml_context(self, path: impl Into<String>) -> Result<T>;
}

impl<T> YamlResultExt<T> for std::result::Result<T, serde_yaml::Error> {
    fn yaml_context(self, path: impl Into<String>) -> Result<T> {
        self.map_err(|e| MpmError::yaml_parse(path, e))
    }
}

/// Extension trait for adding path context to TOML errors.
pub trait TomlResultExt<T> {
    /// Add path context to a TOML parse error.
    fn toml_context(self, path: impl Into<String>) -> Result<T>;
}

impl<T> TomlResultExt<T> for std::result::Result<T, toml::de::Error> {
    fn toml_context(self, path: impl Into<String>) -> Result<T> {
        self.map_err(|e| MpmError::toml_parse(path, e))
    }
}

// Allow converting from String for backwards compatibility during migration
impl From<String> for MpmError {
    fn from(s: String) -> Self {
        Self::Message(s)
    }
}

impl From<&str> for MpmError {
    fn from(s: &str) -> Self {
        Self::Message(s.to_string())
    }
}
