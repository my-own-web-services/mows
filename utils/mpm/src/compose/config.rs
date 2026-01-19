use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

use crate::utils::yaml_to_4_space_indent;

/// Environment variable to override the config file path.
///
/// # Testing
///
/// **IMPORTANT**: All tests that interact with `MpmConfig` MUST set this environment
/// variable to a temporary file path to avoid modifying the user's actual config file
/// at `~/.config/mows.cloud/mpm.yaml`.
///
/// Example:
/// ```ignore
/// use tempfile::NamedTempFile;
/// use std::env;
///
/// let temp_config = NamedTempFile::new().unwrap();
/// env::set_var("MPM_CONFIG_PATH", temp_config.path());
/// // ... run test ...
/// env::remove_var("MPM_CONFIG_PATH");
/// ```
pub const MPM_CONFIG_PATH_ENV: &str = "MPM_CONFIG_PATH";

/// Global mpm configuration stored at ~/.config/mows.cloud/mpm.yaml
/// Can be overridden by setting the MPM_CONFIG_PATH environment variable
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MpmConfig {
    #[serde(default)]
    pub compose: ComposeConfig,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update: Option<UpdateNotification>,
}

/// Stores information about available updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNotification {
    /// The new version that is available
    #[serde(rename = "availableVersion")]
    pub available_version: String,
    /// Unix timestamp of when we last checked for updates
    #[serde(rename = "checkedAt")]
    pub checked_at: u64,
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
    ///
    /// Checks the MPM_CONFIG_PATH environment variable first.
    /// Falls back to ~/.config/mows.cloud/mpm.yaml if not set.
    pub fn config_path() -> Result<PathBuf, String> {
        // Check for environment variable override first
        if let Ok(path) = std::env::var(MPM_CONFIG_PATH_ENV) {
            debug!("Using config path from {}: {}", MPM_CONFIG_PATH_ENV, path);
            return Ok(PathBuf::from(path));
        }

        // Default to ~/.config/mows.cloud/mpm.yaml
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

        let yaml = serde_yaml::to_string(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        let content = yaml_to_4_space_indent(&yaml);

        // Write to temporary file first (atomic write pattern)
        let temp_path = path.with_extension("yaml.tmp");

        // Create file with restrictive permissions (600 - owner read/write only)
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp config file: {}", e))?;

        // Set permissions before writing content
        let permissions = fs::Permissions::from_mode(0o600);
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

    /// Set update notification info
    pub fn set_update_available(&mut self, version: String) {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.update = Some(UpdateNotification {
            available_version: version,
            checked_at: now,
        });
    }

    /// Clear update notification (after user has updated)
    pub fn clear_update_notification(&mut self) {
        self.update = None;
    }

    /// Check if we should check for updates (returns true if no check in last hour)
    pub fn should_check_for_updates(&self) -> bool {
        use std::time::{SystemTime, UNIX_EPOCH};
        match &self.update {
            Some(notification) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                // Check at most once per hour
                now.saturating_sub(notification.checked_at) > 3600
            }
            None => true,
        }
    }
}

#[cfg(test)]
mod tests {
    //! # Test Guidelines
    //!
    //! These tests operate on in-memory config structs only and do NOT touch the filesystem.
    //! If you add tests that call `MpmConfig::load()` or `MpmConfig::save()`, you MUST set
    //! the `MPM_CONFIG_PATH` environment variable to a temporary file path first.
    //! See the documentation on `MPM_CONFIG_PATH_ENV` for details.

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
            update: None,
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
            update: None,
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

    #[test]
    fn test_set_update_available() {
        let mut config = MpmConfig::default();
        assert!(config.update.is_none());

        config.set_update_available("1.2.3".to_string());

        assert!(config.update.is_some());
        let update = config.update.as_ref().unwrap();
        assert_eq!(update.available_version, "1.2.3");
        assert!(update.checked_at > 0);
    }

    #[test]
    fn test_clear_update_notification() {
        let mut config = MpmConfig::default();
        config.set_update_available("1.2.3".to_string());
        assert!(config.update.is_some());

        config.clear_update_notification();
        assert!(config.update.is_none());
    }

    #[test]
    fn test_should_check_for_updates_no_previous_check() {
        let config = MpmConfig::default();
        // Should check when no previous update info exists
        assert!(config.should_check_for_updates());
    }

    #[test]
    fn test_should_check_for_updates_recent_check() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let config = MpmConfig {
            compose: ComposeConfig::default(),
            update: Some(UpdateNotification {
                available_version: "1.0.0".to_string(),
                checked_at: now, // Just checked
            }),
        };

        // Should NOT check when recently checked (within 1 hour)
        assert!(!config.should_check_for_updates());
    }

    #[test]
    fn test_should_check_for_updates_old_check() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let config = MpmConfig {
            compose: ComposeConfig::default(),
            update: Some(UpdateNotification {
                available_version: "1.0.0".to_string(),
                checked_at: now - 7200, // 2 hours ago
            }),
        };

        // Should check when last check was more than 1 hour ago
        assert!(config.should_check_for_updates());
    }

    #[test]
    fn test_should_check_for_updates_boundary() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Exactly at the 1-hour boundary
        let config = MpmConfig {
            compose: ComposeConfig::default(),
            update: Some(UpdateNotification {
                available_version: "1.0.0".to_string(),
                checked_at: now - 3600, // Exactly 1 hour ago
            }),
        };

        // At exactly 3600 seconds, should NOT check (needs to be > 3600)
        assert!(!config.should_check_for_updates());

        // Just past the boundary
        let config = MpmConfig {
            compose: ComposeConfig::default(),
            update: Some(UpdateNotification {
                available_version: "1.0.0".to_string(),
                checked_at: now - 3601, // 1 hour + 1 second ago
            }),
        };

        // Should check now
        assert!(config.should_check_for_updates());
    }
}
