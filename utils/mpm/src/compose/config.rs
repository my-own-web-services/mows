use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

/// Global mpm configuration stored at ~/.config/mows.cloud/mpm.yaml
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MpmConfig {
    #[serde(default)]
    pub compose: ComposeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ComposeConfig {
    #[serde(default)]
    pub projects: Vec<ProjectEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    /// Name from the manifest
    #[serde(rename = "projectName")]
    pub project_name: String,
    /// Optional instance name for multiple deployments of the same project
    #[serde(rename = "instanceName", skip_serializing_if = "Option::is_none")]
    pub instance_name: Option<String>,
    /// Absolute path to the repository root
    #[serde(rename = "repoPath")]
    pub repo_path: PathBuf,
    /// Relative path from repo root to the manifest directory (without mows-manifest.yaml)
    #[serde(rename = "manifestPath")]
    pub manifest_path: PathBuf,
}

impl ProjectEntry {
    /// Get the full path to the manifest directory
    pub fn manifest_dir(&self) -> PathBuf {
        self.repo_path.join(&self.manifest_path)
    }
}

impl MpmConfig {
    /// Get the config file path
    pub fn config_path() -> Result<PathBuf, String> {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME environment variable not set".to_string())?;
        Ok(PathBuf::from(home).join(".config/mows.cloud/mpm.yaml"))
    }

    /// Load the config from disk, or return default if not found
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;

        if !path.exists() {
            debug!("Config file not found, using defaults");
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config file '{}': {}", path.display(), e))?;

        serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse config file '{}': {}", path.display(), e))
    }

    /// Save the config to disk using atomic write
    /// Writes to a temporary file first, then renames to prevent corruption
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;

        // Create parent directories
        let parent = path.parent().ok_or("Invalid config path")?;
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;

        let content = serde_yaml::to_string(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        // Write to temporary file first (atomic write pattern)
        let temp_path = path.with_extension("yaml.tmp");

        // Create file with restrictive permissions (644 - owner read/write, others read)
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp config file: {}", e))?;

        // Set permissions before writing content
        let permissions = fs::Permissions::from_mode(0o644);
        fs::set_permissions(&temp_path, permissions)
            .map_err(|e| format!("Failed to set config file permissions: {}", e))?;

        file.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write temp config file: {}", e))?;

        // Ensure data is flushed to disk
        file.sync_all()
            .map_err(|e| format!("Failed to sync config file: {}", e))?;

        // Atomic rename
        fs::rename(&temp_path, &path)
            .map_err(|e| format!("Failed to save config file: {}", e))?;

        info!("Saved config to {}", path.display());
        Ok(())
    }

    /// Find projects by name
    pub fn find_projects(&self, name: &str) -> Vec<&ProjectEntry> {
        self.compose
            .projects
            .iter()
            .filter(|p| p.project_name == name)
            .collect()
    }

    /// Find a specific project by name and optional instance
    pub fn find_project(&self, name: &str, instance: Option<&str>) -> Option<&ProjectEntry> {
        self.compose.projects.iter().find(|p| {
            p.project_name == name && p.instance_name.as_deref() == instance
        })
    }

    /// Add or update a project entry
    pub fn upsert_project(&mut self, entry: ProjectEntry) {
        // Remove existing entry with same name and instance
        self.compose.projects.retain(|p| {
            !(p.project_name == entry.project_name
              && p.instance_name == entry.instance_name)
        });
        self.compose.projects.push(entry);
    }

    /// Update the manifest path for a project
    pub fn update_manifest_path(
        &mut self,
        project_name: &str,
        instance_name: Option<&str>,
        new_path: &Path,
    ) -> bool {
        for project in &mut self.compose.projects {
            if project.project_name == project_name
               && project.instance_name.as_deref() == instance_name
            {
                project.manifest_path = new_path.to_path_buf();
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serialization() {
        let config = MpmConfig {
            compose: ComposeConfig {
                projects: vec![
                    ProjectEntry {
                        project_name: "test-project".to_string(),
                        instance_name: None,
                        repo_path: PathBuf::from("/home/user/projects/test"),
                        manifest_path: PathBuf::from("./deployment"),
                    },
                    ProjectEntry {
                        project_name: "test-project".to_string(),
                        instance_name: Some("staging".to_string()),
                        repo_path: PathBuf::from("/home/user/projects/test-staging"),
                        manifest_path: PathBuf::from("."),
                    },
                ],
            },
        };

        let yaml = serde_yaml::to_string(&config).unwrap();
        let parsed: MpmConfig = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(parsed.compose.projects.len(), 2);
        assert_eq!(parsed.compose.projects[0].project_name, "test-project");
        assert!(parsed.compose.projects[0].instance_name.is_none());
        assert_eq!(
            parsed.compose.projects[1].instance_name,
            Some("staging".to_string())
        );
    }

    #[test]
    fn test_find_projects() {
        let config = MpmConfig {
            compose: ComposeConfig {
                projects: vec![
                    ProjectEntry {
                        project_name: "project-a".to_string(),
                        instance_name: None,
                        repo_path: PathBuf::from("/a"),
                        manifest_path: PathBuf::from("."),
                    },
                    ProjectEntry {
                        project_name: "project-a".to_string(),
                        instance_name: Some("prod".to_string()),
                        repo_path: PathBuf::from("/a-prod"),
                        manifest_path: PathBuf::from("."),
                    },
                    ProjectEntry {
                        project_name: "project-b".to_string(),
                        instance_name: None,
                        repo_path: PathBuf::from("/b"),
                        manifest_path: PathBuf::from("."),
                    },
                ],
            },
        };

        let projects = config.find_projects("project-a");
        assert_eq!(projects.len(), 2);

        let project = config.find_project("project-a", Some("prod"));
        assert!(project.is_some());
        assert_eq!(project.unwrap().repo_path, PathBuf::from("/a-prod"));

        let project = config.find_project("project-a", None);
        assert!(project.is_some());
        assert_eq!(project.unwrap().repo_path, PathBuf::from("/a"));
    }

    #[test]
    fn test_upsert_project() {
        let mut config = MpmConfig::default();

        config.upsert_project(ProjectEntry {
            project_name: "test".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/old"),
            manifest_path: PathBuf::from("."),
        });

        assert_eq!(config.compose.projects.len(), 1);
        assert_eq!(config.compose.projects[0].repo_path, PathBuf::from("/old"));

        // Update existing
        config.upsert_project(ProjectEntry {
            project_name: "test".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/new"),
            manifest_path: PathBuf::from("."),
        });

        assert_eq!(config.compose.projects.len(), 1);
        assert_eq!(config.compose.projects[0].repo_path, PathBuf::from("/new"));
    }
}
