use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tracing::debug;

use crate::error::{IoResultExt, MpmError, Result};
use crate::utils::parse_yaml;

/// Metadata section of the mows-manifest.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestMetadata {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

/// Definition of a user-provided secret in the manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidedSecretDef {
    /// Default value (null means no default, user must provide)
    pub default: Option<serde_yaml_neo::Value>,
    /// Whether this secret is optional (default: false, meaning required)
    #[serde(default)]
    pub optional: bool,
}

/// Deployment-specific configuration in the manifest's spec.compose section.
///
/// Note: This is different from `config::ComposeConfig` which stores project
/// registrations in the global mpm config file.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values_file_path: Option<String>,
    /// User-provided secrets definitions (key = secret name)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provided_secrets: Option<HashMap<String, ProvidedSecretDef>>,
    // Flatten additional fields for forward compatibility
    #[serde(flatten)]
    pub extra: serde_yaml_neo::Value,
}

/// Specification for different deployment types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compose: Option<DeploymentConfig>,
}

/// The mows-manifest.yaml structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MowsManifest {
    pub manifest_version: String,
    pub metadata: ManifestMetadata,
    #[serde(default)]
    pub spec: ManifestSpec,
}

impl MowsManifest {
    /// Find and load the manifest from a directory
    /// Checks for mows-manifest.yaml and mows-manifest.yml
    pub fn load(dir: &Path) -> Result<Self> {
        let candidates = ["mows-manifest.yaml", "mows-manifest.yml"];

        for name in candidates {
            let path = dir.join(name);
            if path.is_file() {
                debug!("Loading manifest from: {}", path.display());
                let content = fs::read_to_string(&path)
                    .io_context(format!("Failed to read manifest '{}'", path.display()))?;
                return parse_yaml(&content, Some(&path));
            }
        }

        Err(MpmError::Manifest(format!(
            "No mows-manifest.yaml or mows-manifest.yml found in {}",
            dir.display()
        )))
    }

    /// Get the project name from the manifest
    pub fn project_name(&self) -> &str {
        &self.metadata.name
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_load_manifest() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        let mut file = fs::File::create(&manifest_path).unwrap();
        write!(
            file,
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
  description: "A test project"
  version: "1.0.0"
spec:
  compose: {{}}
"#
        )
        .unwrap();

        let manifest = MowsManifest::load(dir.path()).unwrap();
        assert_eq!(manifest.project_name(), "test-project");
        assert_eq!(manifest.manifest_version, "0.1");
        assert!(manifest.spec.compose.is_some());
    }

    #[test]
    fn test_load_manifest_yml_extension() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yml");
        let mut file = fs::File::create(&manifest_path).unwrap();
        write!(
            file,
            r#"manifestVersion: "0.1"
metadata:
  name: yml-project
spec:
  compose: {{}}
"#
        )
        .unwrap();

        let manifest = MowsManifest::load(dir.path()).unwrap();
        assert_eq!(manifest.project_name(), "yml-project");
    }

    #[test]
    fn test_manifest_not_found() {
        let dir = tempdir().unwrap();
        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("No mows-manifest.yaml"));
    }

    #[test]
    fn test_spec_serialization() {
        let spec = ManifestSpec {
            compose: Some(DeploymentConfig::default()),
        };
        let yaml = serde_yaml_neo::to_string(&spec).unwrap();
        println!("Serialized spec:\n{}", yaml);

        // Now try to deserialize that back
        let result: std::result::Result<ManifestSpec, _> = serde_yaml_neo::from_str(&yaml);
        println!("Deserialize own output: {:?}", result);
        assert!(result.is_ok());
        assert!(result.unwrap().compose.is_some());
    }

    #[test]
    fn test_spec_with_values_file_path() {
        let spec = ManifestSpec {
            compose: Some(DeploymentConfig {
                values_file_path: Some("values/development.yaml".to_string()),
                provided_secrets: None,
                extra: serde_yaml_neo::Value::default(),
            }),
        };
        let yaml = serde_yaml_neo::to_string(&spec).unwrap();
        println!("Serialized spec with valuesFilePath:\n{}", yaml);

        assert!(yaml.contains("compose:"));
        assert!(yaml.contains("valuesFilePath:"));
        assert!(yaml.contains("values/development.yaml"));

        // Test deserialization
        let deserialized: ManifestSpec = serde_yaml_neo::from_str(&yaml).unwrap();
        assert!(deserialized.compose.is_some());
        let compose = deserialized.compose.unwrap();
        assert_eq!(
            compose.values_file_path,
            Some("values/development.yaml".to_string())
        );
    }

    #[test]
    fn test_manifest_with_provided_secrets() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
spec:
  compose:
    providedSecrets:
      API_KEY:
        default: null
        optional: false
      SMTP_PORT:
        default: 465
        optional: false
      OPTIONAL_SECRET:
        default: "default-value"
        optional: true
"#,
        )
        .unwrap();

        let manifest = MowsManifest::load(dir.path()).unwrap();
        assert_eq!(manifest.project_name(), "test-project");

        let compose = manifest.spec.compose.unwrap();
        let secrets = compose.provided_secrets.unwrap();

        assert_eq!(secrets.len(), 3);

        // Check API_KEY (required, no default)
        let api_key = secrets.get("API_KEY").unwrap();
        assert!(!api_key.optional);
        assert!(api_key.default.as_ref().map(|v| v.is_null()).unwrap_or(true));

        // Check SMTP_PORT (required, has default)
        let smtp_port = secrets.get("SMTP_PORT").unwrap();
        assert!(!smtp_port.optional);
        assert_eq!(
            smtp_port.default.as_ref().and_then(|v| v.as_u64()),
            Some(465)
        );

        // Check OPTIONAL_SECRET (optional, has default)
        let optional = secrets.get("OPTIONAL_SECRET").unwrap();
        assert!(optional.optional);
        assert_eq!(
            optional.default.as_ref().and_then(|v| v.as_str()),
            Some("default-value")
        );
    }

    // =========================================================================
    // Validation Tests (#58) - Invalid versions, missing fields, malformed YAML
    // =========================================================================

    #[test]
    fn test_manifest_missing_manifest_version() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"metadata:
  name: test-project
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("missing field") || err.contains("manifestVersion"),
            "Expected error about missing manifestVersion, got: {}",
            err
        );
    }

    #[test]
    fn test_manifest_missing_metadata() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("missing field") || err.contains("metadata"),
            "Expected error about missing metadata, got: {}",
            err
        );
    }

    #[test]
    fn test_manifest_missing_metadata_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  description: "No name field"
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("missing field") || err.contains("name"),
            "Expected error about missing name, got: {}",
            err
        );
    }

    #[test]
    fn test_manifest_invalid_yaml_syntax() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
  invalid yaml here: [unclosed bracket
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_wrong_type_for_manifest_version() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: 123
metadata:
  name: test-project
spec:
  compose: {}
"#,
        )
        .unwrap();

        // Numbers are coerced to strings in YAML, so this should actually work
        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().manifest_version, "123");
    }

    #[test]
    fn test_manifest_wrong_type_for_metadata() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata: "should be an object"
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("invalid type") || err.contains("expected") || err.contains("struct"),
            "Expected type error, got: {}",
            err
        );
    }

    #[test]
    fn test_manifest_empty_file() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(&manifest_path, "").unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_null_content() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(&manifest_path, "null").unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_array_instead_of_object() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"- item1
- item2
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_unknown_fields_allowed() {
        // Unknown fields should be ignored (forward compatibility)
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
  unknownField: "should be ignored"
  anotherUnknown: 123
spec:
  compose: {}
  kubernetes: {}
  unknownSpec: "also ignored"
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_name(), "test-project");
    }

    #[test]
    fn test_manifest_deeply_nested_invalid() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
spec:
  compose:
    repositoryUrl: 12345
"#,
        )
        .unwrap();

        // repositoryUrl should be a string, but numbers get coerced
        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_manifest_special_characters_in_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: "project-with-special_chars.v2"
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_name(), "project-with-special_chars.v2");
    }

    #[test]
    fn test_manifest_unicode_in_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: "项目名称"
  description: "プロジェクト説明"
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_name(), "项目名称");
    }

    #[test]
    fn test_manifest_very_long_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        let long_name = "a".repeat(10000);
        fs::write(
            &manifest_path,
            format!(
                r#"manifestVersion: "0.1"
metadata:
  name: "{}"
spec:
  compose: {{}}
"#,
                long_name
            ),
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_name().len(), 10000);
    }

    #[test]
    fn test_manifest_empty_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: ""
spec:
  compose: {}
"#,
        )
        .unwrap();

        // Empty name is technically valid YAML but semantically problematic
        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_name(), "");
    }

    #[test]
    fn test_manifest_whitespace_only_name() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
metadata:
  name: "   "
spec:
  compose: {}
"#,
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_manifest_tab_indentation() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        // YAML with tabs (often problematic)
        fs::write(
            &manifest_path,
            "manifestVersion: \"0.1\"\nmetadata:\n\tname: test-project\nspec:\n\tcompose: {}\n",
        )
        .unwrap();

        let result = MowsManifest::load(dir.path());
        // Tabs in YAML can cause issues
        // The result depends on the YAML parser behavior
        // Just ensure it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_manifest_duplicate_keys() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("mows-manifest.yaml");
        fs::write(
            &manifest_path,
            r#"manifestVersion: "0.1"
manifestVersion: "0.2"
metadata:
  name: test-project
  name: other-name
spec:
  compose: {}
"#,
        )
        .unwrap();

        // Duplicate keys behavior depends on parser - last wins typically
        let result = MowsManifest::load(dir.path());
        // Just ensure it doesn't panic
        let _ = result;
    }
}
