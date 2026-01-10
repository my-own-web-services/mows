use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tracing::debug;

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

/// The mows-manifest.yaml structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MowsManifest {
    pub manifest_version: String,
    pub metadata: ManifestMetadata,
    #[serde(default)]
    pub spec: serde_yaml::Value,
}

impl MowsManifest {
    /// Find and load the manifest from a directory
    /// Checks for mows-manifest.yaml and mows-manifest.yml
    pub fn load(dir: &Path) -> Result<Self, String> {
        let candidates = ["mows-manifest.yaml", "mows-manifest.yml"];

        for name in candidates {
            let path = dir.join(name);
            if path.is_file() {
                debug!("Loading manifest from: {}", path.display());
                let content = fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read manifest '{}': {}", path.display(), e))?;
                return parse_yaml(&content, Some(&path));
            }
        }

        Err(format!(
            "No mows-manifest.yaml or mows-manifest.yml found in {}",
            dir.display()
        ))
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
spec: {{}}
"#
        )
        .unwrap();

        let manifest = MowsManifest::load(dir.path()).unwrap();
        assert_eq!(manifest.project_name(), "test-project");
        assert_eq!(manifest.manifest_version, "0.1");
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
spec: {{}}
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
        assert!(result.unwrap_err().contains("No mows-manifest.yaml"));
    }
}
