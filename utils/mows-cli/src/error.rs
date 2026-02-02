//! Error types for mows-cli.
//!
//! This module provides a unified error type for the entire application,
//! enabling proper error handling, context preservation, and pattern matching.

use std::path::PathBuf;
use thiserror::Error;

/// The main error type for mows operations.
#[derive(Debug, Error)]
pub enum MowsError {
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
        source: serde_yaml_neo::Error,
    },

    /// YAML serialization error.
    #[error("Failed to serialize YAML: {0}")]
    YamlSerialize(#[from] serde_yaml_neo::Error),

    /// JSON parsing error with context.
    #[error("Failed to parse JSON in {context}: {source}")]
    JsonParse {
        context: String,
        #[source]
        source: serde_json::Error,
    },

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

/// Result type alias for mows operations.
pub type Result<T> = std::result::Result<T, MowsError>;

impl MowsError {
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
    pub fn yaml_parse(path: impl Into<String>, source: serde_yaml_neo::Error) -> Self {
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

    /// Create a JSON parse error with context.
    pub fn json_parse(context: impl Into<String>, source: serde_json::Error) -> Self {
        Self::JsonParse {
            context: context.into(),
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
        self.map_err(|e| MowsError::io(context, e))
    }
}

/// Extension trait for adding path context to YAML errors.
pub trait YamlResultExt<T> {
    /// Add path context to a YAML parse error.
    fn yaml_context(self, path: impl Into<String>) -> Result<T>;
}

impl<T> YamlResultExt<T> for std::result::Result<T, serde_yaml_neo::Error> {
    fn yaml_context(self, path: impl Into<String>) -> Result<T> {
        self.map_err(|e| MowsError::yaml_parse(path, e))
    }
}

/// Extension trait for adding path context to TOML errors.
pub trait TomlResultExt<T> {
    /// Add path context to a TOML parse error.
    fn toml_context(self, path: impl Into<String>) -> Result<T>;
}

impl<T> TomlResultExt<T> for std::result::Result<T, toml::de::Error> {
    fn toml_context(self, path: impl Into<String>) -> Result<T> {
        self.map_err(|e| MowsError::toml_parse(path, e))
    }
}

/// Extension trait for adding context to JSON errors.
pub trait JsonResultExt<T> {
    /// Add context to a JSON parse error.
    fn json_context(self, context: impl Into<String>) -> Result<T>;
}

impl<T> JsonResultExt<T> for std::result::Result<T, serde_json::Error> {
    fn json_context(self, context: impl Into<String>) -> Result<T> {
        self.map_err(|e| MowsError::json_parse(context, e))
    }
}

// Allow converting from String for backwards compatibility during migration
impl From<String> for MowsError {
    fn from(s: String) -> Self {
        Self::Message(s)
    }
}

impl From<&str> for MowsError {
    fn from(s: &str) -> Self {
        Self::Message(s.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error;

    #[test]
    fn test_io_result_ext_preserves_error_chain() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let result: std::result::Result<(), std::io::Error> = Err(io_error);

        let mows_result = result.io_context("Reading config file");
        assert!(mows_result.is_err());

        let err = mows_result.unwrap_err();
        assert!(matches!(err, MowsError::Io { .. }));

        // Verify error message contains context
        let msg = err.to_string();
        assert!(msg.contains("Reading config file"));
        assert!(msg.contains("file not found"));

        // Verify source error is preserved
        assert!(err.source().is_some());
    }

    #[test]
    fn test_io_result_ext_success_passes_through() {
        let result: std::result::Result<i32, std::io::Error> = Ok(42);
        let mows_result = result.io_context("Should not appear");
        assert_eq!(mows_result.unwrap(), 42);
    }

    #[test]
    fn test_yaml_result_ext_preserves_error_chain() {
        // Create a YAML parse error
        let yaml_result: std::result::Result<serde_yaml_neo::Value, _> =
            serde_yaml_neo::from_str("invalid: yaml: content:");

        let mows_result = yaml_result.yaml_context("/path/to/file.yaml");
        assert!(mows_result.is_err());

        let err = mows_result.unwrap_err();
        assert!(matches!(err, MowsError::YamlParse { .. }));

        // Verify error message contains path
        let msg = err.to_string();
        assert!(msg.contains("/path/to/file.yaml"));

        // Verify source error is preserved
        assert!(err.source().is_some());
    }

    #[test]
    fn test_yaml_result_ext_success_passes_through() {
        let yaml_result: std::result::Result<serde_yaml_neo::Value, _> =
            serde_yaml_neo::from_str("key: value");

        let mows_result = yaml_result.yaml_context("/path/to/file.yaml");
        assert!(mows_result.is_ok());
    }

    #[test]
    fn test_toml_result_ext_preserves_error_chain() {
        // Create a TOML parse error
        let toml_result: std::result::Result<toml::Value, _> = toml::from_str("invalid = [");

        let mows_result = toml_result.toml_context("/path/to/Cargo.toml");
        assert!(mows_result.is_err());

        let err = mows_result.unwrap_err();
        assert!(matches!(err, MowsError::TomlParse { .. }));

        // Verify error message contains path
        let msg = err.to_string();
        assert!(msg.contains("/path/to/Cargo.toml"));

        // Verify source error is preserved
        assert!(err.source().is_some());
    }

    #[test]
    fn test_toml_result_ext_success_passes_through() {
        let toml_result: std::result::Result<toml::Value, _> = toml::from_str("key = \"value\"");

        let mows_result = toml_result.toml_context("/path/to/Cargo.toml");
        assert!(mows_result.is_ok());
    }

    #[test]
    fn test_json_result_ext_preserves_error_chain() {
        use super::JsonResultExt;

        // Create a JSON parse error
        let json_result: std::result::Result<serde_json::Value, _> =
            serde_json::from_str("{ invalid json }");

        let mows_result = json_result.json_context("/path/to/data.json");
        assert!(mows_result.is_err());

        let err = mows_result.unwrap_err();
        assert!(matches!(err, MowsError::JsonParse { .. }));

        // Verify error message contains context
        let msg = err.to_string();
        assert!(msg.contains("/path/to/data.json"));

        // Verify source error is preserved
        assert!(err.source().is_some());
    }

    #[test]
    fn test_json_result_ext_success_passes_through() {
        use super::JsonResultExt;

        let json_result: std::result::Result<serde_json::Value, _> =
            serde_json::from_str(r#"{"key": "value"}"#);

        let mows_result = json_result.json_context("/path/to/data.json");
        assert!(mows_result.is_ok());
    }

    #[test]
    fn test_mpm_error_constructors() {
        // Test io constructor
        let io_err = MowsError::io(
            "Reading file",
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied"),
        );
        assert!(matches!(io_err, MowsError::Io { .. }));
        assert!(io_err.to_string().contains("Reading file"));

        // Test path constructor
        let path_err = MowsError::path("/some/path", "Path does not exist");
        assert!(matches!(path_err, MowsError::Path { .. }));
        assert!(path_err.to_string().contains("/some/path"));

        // Test command constructor
        let cmd_err = MowsError::command("git clone", "repository not found");
        assert!(matches!(cmd_err, MowsError::Command { .. }));
        assert!(cmd_err.to_string().contains("git clone"));
    }

    #[test]
    fn test_string_conversions() {
        let err1: MowsError = "Simple error message".into();
        assert!(matches!(err1, MowsError::Message(_)));
        assert_eq!(err1.to_string(), "Simple error message");

        let err2: MowsError = String::from("Another error").into();
        assert!(matches!(err2, MowsError::Message(_)));
        assert_eq!(err2.to_string(), "Another error");
    }
}
