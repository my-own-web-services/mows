use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

use crate::error::{IoResultExt, MpmError, Result};

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

/// File permission mode for config file: owner read/write only (rw-------).
/// Prevents other users from reading potentially sensitive project paths.
const CONFIG_FILE_MODE: u32 = 0o600;

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
    pub fn config_path() -> Result<PathBuf> {
        // Check for environment variable override first
        if let Ok(path) = std::env::var(MPM_CONFIG_PATH_ENV) {
            debug!("Using config path from {}: {}", MPM_CONFIG_PATH_ENV, path);
            return Ok(PathBuf::from(path));
        }

        // Default to ~/.config/mows.cloud/mpm.yaml
        let home = std::env::var("HOME")
            .map_err(|_| MpmError::Config("HOME environment variable not set".to_string()))?;
        Ok(PathBuf::from(home).join(".config/mows.cloud/mpm.yaml"))
    }

    /// Get the lock file path for concurrent access protection
    fn lock_path() -> Result<PathBuf> {
        let config_path = Self::config_path()?;
        Ok(config_path.with_extension("yaml.lock"))
    }

    /// Acquire an exclusive lock on the config file
    /// Returns the lock file handle which releases the lock when dropped
    fn acquire_lock() -> Result<File> {
        let lock_path = Self::lock_path()?;

        // Create parent directory if needed
        if let Some(parent) = lock_path.parent() {
            fs::create_dir_all(parent)
                .io_context("Failed to create config directory")?;
        }

        // Open or create the lock file
        let lock_file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(&lock_path)
            .io_context("Failed to open config lock file")?;

        // Acquire exclusive lock (blocks until available)
        lock_file.lock_exclusive()
            .io_context("Failed to acquire config file lock")?;

        debug!("Acquired config file lock");
        Ok(lock_file)
    }

    /// Execute a closure that modifies the config atomically with file locking.
    ///
    /// This prevents race conditions when multiple mpm processes access the config
    /// simultaneously. The lock is held for the entire read-modify-write operation.
    ///
    /// # Example
    /// ```ignore
    /// MpmConfig::with_locked(|config| {
    ///     config.upsert_project(entry);
    /// })?;
    /// ```
    pub fn with_locked<F>(f: F) -> Result<()>
    where
        F: FnOnce(&mut MpmConfig),
    {
        // Acquire exclusive lock (released when _lock_file is dropped)
        let _lock_file = Self::acquire_lock()?;

        // Load current config (or default if not exists)
        let mut config = Self::load()?;

        // Apply modifications
        f(&mut config);

        // Save with the lock still held
        config.save_without_lock()?;

        debug!("Released config file lock");
        Ok(())
    }

    /// Load the config from disk, or return default if not found
    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;

        if !path.exists() {
            debug!("Config file not found, using defaults");
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .io_context(format!("Failed to read config file '{}'", path.display()))?;

        serde_yaml_neo::from_str(&content)
            .map_err(|e| MpmError::Config(format!("Failed to parse config file '{}': {}", path.display(), e)))
    }

    /// Save the config to disk using atomic write with file locking.
    ///
    /// For read-modify-write operations, prefer using `with_locked()` instead
    /// to ensure the entire operation is atomic.
    ///
    /// This method acquires an exclusive lock, writes the config, then releases
    /// the lock. Uses a temporary file + rename for crash safety.
    pub fn save(&self) -> Result<()> {
        // Acquire exclusive lock for the write operation
        let _lock_file = Self::acquire_lock()?;
        self.save_without_lock()
    }

    /// Internal save without acquiring lock (used by with_locked)
    fn save_without_lock(&self) -> Result<()> {
        let path = Self::config_path()?;

        // Create parent directories
        let parent = path.parent().ok_or_else(|| MpmError::Config("Invalid config path".to_string()))?;
        fs::create_dir_all(parent)
            .io_context("Failed to create config directory")?;

        let content = serde_yaml_neo::to_string_with_indent(self, 4)?;

        // Write to temporary file first (atomic write pattern)
        let temp_path = path.with_extension("yaml.tmp");

        // Create file with restrictive permissions (600 - owner read/write only)
        let mut file = File::create(&temp_path)
            .io_context("Failed to create temp config file")?;

        // Set permissions before writing content
        let permissions = fs::Permissions::from_mode(CONFIG_FILE_MODE);
        fs::set_permissions(&temp_path, permissions)
            .io_context("Failed to set config file permissions")?;

        file.write_all(content.as_bytes())
            .io_context("Failed to write temp config file")?;

        // Ensure data is flushed to disk
        file.sync_all()
            .io_context("Failed to sync config file")?;

        // Atomic rename
        fs::rename(&temp_path, &path)
            .io_context("Failed to save config file")?;

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
    //! If you add tests that call `MpmConfig::load()` or `MpmConfig::save()`, you MUST use
    //! the `TestConfigGuard` helper to ensure proper isolation.
    //! See the documentation on `MPM_CONFIG_PATH_ENV` for details.

    use super::*;
    use std::sync::Mutex;
    use tempfile::NamedTempFile;

    /// Global mutex to prevent concurrent config tests from interfering with each other.
    /// This is necessary because environment variables are process-global.
    static CONFIG_TEST_MUTEX: Mutex<()> = Mutex::new(());

    /// RAII guard that sets up an isolated config environment for testing.
    ///
    /// This guard:
    /// 1. Acquires a mutex to prevent concurrent config tests
    /// 2. Creates a temporary file for the config
    /// 3. Sets `MPM_CONFIG_PATH` to the temp file path
    /// 4. Automatically cleans up when dropped
    ///
    /// # Example
    /// ```ignore
    /// #[test]
    /// fn test_config_persistence() {
    ///     let _guard = TestConfigGuard::new();
    ///
    ///     let mut config = MpmConfig::default();
    ///     config.set_update_available("1.0.0".to_string());
    ///     config.save().unwrap();
    ///
    ///     let loaded = MpmConfig::load().unwrap();
    ///     assert_eq!(loaded.update.unwrap().available_version, "1.0.0");
    /// }
    /// ```
    struct TestConfigGuard {
        _temp_file: NamedTempFile,
        _lock: std::sync::MutexGuard<'static, ()>,
    }

    impl TestConfigGuard {
        fn new() -> Self {
            let lock = CONFIG_TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
            let temp_file = NamedTempFile::new().expect("Failed to create temp config file");
            std::env::set_var(MPM_CONFIG_PATH_ENV, temp_file.path());
            Self {
                _temp_file: temp_file,
                _lock: lock,
            }
        }
    }

    impl Drop for TestConfigGuard {
        fn drop(&mut self) {
            std::env::remove_var(MPM_CONFIG_PATH_ENV);
        }
    }

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

        let yaml = serde_yaml_neo::to_string(&config).unwrap();
        let parsed: MpmConfig = serde_yaml_neo::from_str(&yaml).unwrap();

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

    // =========================================================================
    // Tests that exercise load() and save() with proper isolation
    // =========================================================================

    #[test]
    fn test_config_save_and_load_roundtrip() {
        let _guard = TestConfigGuard::new();

        let mut config = MpmConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "test-project".to_string(),
            instance_name: Some("production".to_string()),
            repo_path: PathBuf::from("/home/user/projects/test"),
            manifest_path: PathBuf::from("./deployment"),
        });
        config.set_update_available("2.0.0".to_string());

        config.save().expect("Failed to save config");

        let loaded = MpmConfig::load().expect("Failed to load config");

        assert_eq!(loaded.compose.projects.len(), 1);
        assert_eq!(loaded.compose.projects[0].project_name, "test-project");
        assert_eq!(
            loaded.compose.projects[0].instance_name,
            Some("production".to_string())
        );
        assert!(loaded.update.is_some());
        assert_eq!(loaded.update.unwrap().available_version, "2.0.0");
    }

    #[test]
    fn test_config_load_returns_default_when_not_exists() {
        let _guard = TestConfigGuard::new();

        // The temp file exists but is empty, so load should return default
        let config = MpmConfig::load().expect("Failed to load config");

        assert!(config.compose.projects.is_empty());
        assert!(config.update.is_none());
    }

    #[test]
    fn test_config_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let _guard = TestConfigGuard::new();

        let config = MpmConfig::default();
        config.save().expect("Failed to save config");

        let path = MpmConfig::config_path().expect("Failed to get config path");
        let metadata = std::fs::metadata(&path).expect("Failed to get file metadata");
        let mode = metadata.permissions().mode() & 0o777;

        // Should be 600 (owner read/write only)
        assert_eq!(mode, 0o600, "Config file should have 600 permissions");
    }

    #[test]
    fn test_config_path_uses_env_var() {
        let _guard = TestConfigGuard::new();

        let path = MpmConfig::config_path().expect("Failed to get config path");
        let env_path = std::env::var(MPM_CONFIG_PATH_ENV).expect("Env var not set");

        assert_eq!(path.to_str().unwrap(), env_path);
    }

    #[test]
    fn test_config_multiple_projects_roundtrip() {
        let _guard = TestConfigGuard::new();

        let mut config = MpmConfig::default();

        // Add multiple projects with various configurations
        config.upsert_project(ProjectEntry {
            project_name: "project-a".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/home/user/a"),
            manifest_path: PathBuf::from("."),
        });
        config.upsert_project(ProjectEntry {
            project_name: "project-a".to_string(),
            instance_name: Some("staging".to_string()),
            repo_path: PathBuf::from("/home/user/a-staging"),
            manifest_path: PathBuf::from("./deploy"),
        });
        config.upsert_project(ProjectEntry {
            project_name: "project-b".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/home/user/b"),
            manifest_path: PathBuf::from("./infra"),
        });

        config.save().expect("Failed to save config");

        let loaded = MpmConfig::load().expect("Failed to load config");

        assert_eq!(loaded.compose.projects.len(), 3);

        // Verify we can find all projects
        assert_eq!(loaded.find_projects("project-a").len(), 2);
        assert_eq!(loaded.find_projects("project-b").len(), 1);
        assert!(loaded.find_project("project-a", Some("staging")).is_some());
    }
}
