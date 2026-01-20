use serde::{Deserialize, Serialize};
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

/// Configuration specific to compose deployments
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComposeConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values_file_path: Option<String>,
    // Flatten additional fields for forward compatibility
    #[serde(flatten)]
    pub extra: serde_yaml_neo::Value,
}

/// Specification for different deployment types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compose: Option<ComposeConfig>,
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
            compose: Some(ComposeConfig::default()),
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
    fn test_spec_with_repository_url() {
        let spec = ManifestSpec {
            compose: Some(ComposeConfig {
                repository_url: Some("https://github.com/user/repo".to_string()),
                values_file_path: None,
                extra: serde_yaml_neo::Value::default(),
            }),
        };
        let yaml = serde_yaml_neo::to_string(&spec).unwrap();
        println!("Serialized spec with repositoryUrl:\n{}", yaml);

        assert!(yaml.contains("compose:"));
        assert!(yaml.contains("repositoryUrl:"));
        assert!(yaml.contains("https://github.com/user/repo"));

        // Test deserialization
        let deserialized: ManifestSpec = serde_yaml_neo::from_str(&yaml).unwrap();
        assert!(deserialized.compose.is_some());
        assert_eq!(
            deserialized.compose.unwrap().repository_url,
            Some("https://github.com/user/repo".to_string())
        );
    }

    #[test]
    fn test_spec_with_values_file_path() {
        let spec = ManifestSpec {
            compose: Some(ComposeConfig {
                repository_url: None,
                values_file_path: Some("values/development.yaml".to_string()),
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
}
