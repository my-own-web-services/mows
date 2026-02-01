use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

use crate::error::{IoResultExt, MowsError, Result};

use super::SENSITIVE_FILE_MODE;

/// Primary environment variable to override the config file path.
pub const MOWS_CONFIG_PATH_ENV: &str = "MOWS_CONFIG_PATH";

/// Legacy environment variable (checked as fallback for backward compatibility).
pub const MPM_CONFIG_PATH_ENV: &str = "MPM_CONFIG_PATH";

/// Legacy config filename (auto-migrated to `mows.yaml` on first access).
const LEGACY_CONFIG_FILENAME: &str = "mpm.yaml";

/// Current config filename.
const CONFIG_FILENAME: &str = "mows.yaml";

/// Global mows configuration stored at ~/.config/mows.cloud/mows.yaml
/// Can be overridden by setting the MOWS_CONFIG_PATH (or legacy MPM_CONFIG_PATH) environment variable
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MowsConfig {
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

impl MowsConfig {
    /// Get the config file path.
    ///
    /// Resolution order:
    /// 1. `MOWS_CONFIG_PATH` environment variable (primary)
    /// 2. `MPM_CONFIG_PATH` environment variable (legacy fallback)
    /// 3. `~/.config/mows.cloud/mows.yaml` (default; auto-migrates from `mpm.yaml` if present)
    pub fn config_path() -> Result<PathBuf> {
        // Check primary env var first
        if let Ok(path) = std::env::var(MOWS_CONFIG_PATH_ENV) {
            debug!("Using config path from {}: {}", MOWS_CONFIG_PATH_ENV, path);
            return Ok(PathBuf::from(path));
        }

        // Check legacy env var
        if let Ok(path) = std::env::var(MPM_CONFIG_PATH_ENV) {
            debug!("Using config path from {}: {}", MPM_CONFIG_PATH_ENV, path);
            return Ok(PathBuf::from(path));
        }

        let home = std::env::var("HOME")
            .map_err(|_| MowsError::Config("HOME environment variable not set".to_string()))?;
        let config_dir = PathBuf::from(home).join(".config/mows.cloud");
        let new_path = config_dir.join(CONFIG_FILENAME);
        let legacy_path = config_dir.join(LEGACY_CONFIG_FILENAME);

        // Auto-migrate legacy config file if it exists and new one doesn't
        if !new_path.exists() && legacy_path.exists() {
            debug!("Migrating config from {} to {}", legacy_path.display(), new_path.display());
            if let Err(e) = fs::rename(&legacy_path, &new_path) {
                // Non-fatal: fall back to legacy path if rename fails
                debug!("Config migration failed ({}), using legacy path", e);
                return Ok(legacy_path);
            }
            info!("Migrated config file from {} to {}", LEGACY_CONFIG_FILENAME, CONFIG_FILENAME);
        }

        Ok(new_path)
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

    /// Load the config from disk, or return default if not found.
    ///
    /// Note: For read-modify-write operations, use `with_locked()` instead
    /// to prevent race conditions.
    pub fn load() -> Result<Self> {
        Self::load_internal()
    }

    /// Internal load implementation (used by both load() and with_locked())
    fn load_internal() -> Result<Self> {
        let path = Self::config_path()?;

        if !path.exists() {
            debug!("Config file not found, using defaults");
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .io_context(format!("Failed to read config file '{}'", path.display()))?;

        serde_yaml_neo::from_str(&content)
            .map_err(|e| MowsError::Config(format!("Failed to parse config file '{}': {}", path.display(), e)))
    }

    /// Execute a read-modify-write operation atomically under a lock.
    ///
    /// This method:
    /// 1. Acquires an exclusive file lock
    /// 2. Loads the current config
    /// 3. Passes the config to the closure for modification
    /// 4. Saves the modified config
    /// 5. Releases the lock
    ///
    /// Use this instead of separate `load()` + `save()` calls to prevent
    /// race conditions in concurrent updates.
    ///
    /// # Example
    /// ```ignore
    /// MowsConfig::with_locked(|config| {
    ///     config.upsert_project(entry);
    ///     Ok(())
    /// })?;
    /// ```
    pub fn with_locked<F>(operation: F) -> Result<()>
    where
        F: FnOnce(&mut Self) -> Result<()>,
    {
        // Acquire exclusive lock for the entire read-modify-write cycle
        let _lock_file = Self::acquire_lock()?;

        // Load current config (without acquiring another lock)
        let mut config = Self::load_internal()?;

        // Run the modification operation
        operation(&mut config)?;

        // Save the modified config (without acquiring another lock)
        config.save_without_lock()
    }

    /// Save the config to disk using atomic write with file locking.
    ///
    /// For read-modify-write operations, prefer using `with_locked()` instead
    /// to ensure the entire operation is atomic.
    ///
    /// This method acquires an exclusive lock, writes the config, then releases
    /// the lock. Uses a temporary file + rename for crash safety.
    #[cfg(test)]
    pub fn save(&self) -> Result<()> {
        // Acquire exclusive lock for the write operation
        let _lock_file = Self::acquire_lock()?;
        self.save_without_lock()
    }

    /// Internal save without acquiring lock (used by with_locked)
    fn save_without_lock(&self) -> Result<()> {
        let path = Self::config_path()?;

        // Create parent directories
        let parent = path.parent().ok_or_else(|| MowsError::Config("Invalid config path".to_string()))?;
        fs::create_dir_all(parent)
            .io_context("Failed to create config directory")?;

        let content = serde_yaml_neo::to_string_with_indent(self, 4)?;

        // Write to temporary file first (atomic write pattern)
        let temp_path = path.with_extension("yaml.tmp");

        // Create file with restrictive permissions (600 - owner read/write only)
        let mut file = File::create(&temp_path)
            .io_context("Failed to create temp config file")?;

        // Set permissions before writing content
        let permissions = fs::Permissions::from_mode(SENSITIVE_FILE_MODE);
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

// Test utilities for config isolation - exported for use by other test modules
#[cfg(test)]
pub mod test_utils {
    use super::{MOWS_CONFIG_PATH_ENV, MPM_CONFIG_PATH_ENV};
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
    /// 3. Sets `MOWS_CONFIG_PATH` to the temp file path
    /// 4. Automatically cleans up when dropped
    pub struct TestConfigGuard {
        _temp_file: NamedTempFile,
        _lock: std::sync::MutexGuard<'static, ()>,
    }

    impl TestConfigGuard {
        pub fn new() -> Self {
            let lock = CONFIG_TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
            let temp_file = NamedTempFile::new().expect("Failed to create temp config file");
            // Use primary env var for test isolation
            std::env::set_var(MOWS_CONFIG_PATH_ENV, temp_file.path());
            // Clear legacy var to avoid interference
            std::env::remove_var(MPM_CONFIG_PATH_ENV);
            Self {
                _temp_file: temp_file,
                _lock: lock,
            }
        }
    }

    impl Drop for TestConfigGuard {
        fn drop(&mut self) {
            std::env::remove_var(MOWS_CONFIG_PATH_ENV);
            std::env::remove_var(MPM_CONFIG_PATH_ENV);
        }
    }
}

#[cfg(test)]
mod tests {
    //! # Test Guidelines
    //!
    //! These tests operate on in-memory config structs only and do NOT touch the filesystem.
    //! If you add tests that call `MowsConfig::load()` or `MowsConfig::save()`, you MUST use
    //! the `TestConfigGuard` helper to ensure proper isolation.
    //! See the documentation on `MPM_CONFIG_PATH_ENV` for details.

    use super::*;
    use super::test_utils::TestConfigGuard;

    #[test]
    fn test_config_serialization() {
        let config = MowsConfig {
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
        let parsed: MowsConfig = serde_yaml_neo::from_str(&yaml).unwrap();

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
        let config = MowsConfig {
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
        let mut config = MowsConfig::default();

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
        let mut config = MowsConfig::default();
        assert!(config.update.is_none());

        config.set_update_available("1.2.3".to_string());

        assert!(config.update.is_some());
        let update = config.update.as_ref().unwrap();
        assert_eq!(update.available_version, "1.2.3");
        assert!(update.checked_at > 0);
    }

    #[test]
    fn test_clear_update_notification() {
        let mut config = MowsConfig::default();
        config.set_update_available("1.2.3".to_string());
        assert!(config.update.is_some());

        config.clear_update_notification();
        assert!(config.update.is_none());
    }

    #[test]
    fn test_should_check_for_updates_no_previous_check() {
        let config = MowsConfig::default();
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

        let config = MowsConfig {
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

        let config = MowsConfig {
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
        let config = MowsConfig {
            compose: ComposeConfig::default(),
            update: Some(UpdateNotification {
                available_version: "1.0.0".to_string(),
                checked_at: now - 3600, // Exactly 1 hour ago
            }),
        };

        // At exactly 3600 seconds, should NOT check (needs to be > 3600)
        assert!(!config.should_check_for_updates());

        // Just past the boundary
        let config = MowsConfig {
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

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "test-project".to_string(),
            instance_name: Some("production".to_string()),
            repo_path: PathBuf::from("/home/user/projects/test"),
            manifest_path: PathBuf::from("./deployment"),
        });
        config.set_update_available("2.0.0".to_string());

        config.save().expect("Failed to save config");

        let loaded = MowsConfig::load().expect("Failed to load config");

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
        let config = MowsConfig::load().expect("Failed to load config");

        assert!(config.compose.projects.is_empty());
        assert!(config.update.is_none());
    }

    #[test]
    fn test_config_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let _guard = TestConfigGuard::new();

        let config = MowsConfig::default();
        config.save().expect("Failed to save config");

        let path = MowsConfig::config_path().expect("Failed to get config path");
        let metadata = std::fs::metadata(&path).expect("Failed to get file metadata");
        let mode = metadata.permissions().mode() & 0o777;

        // Should be 600 (owner read/write only)
        assert_eq!(mode, 0o600, "Config file should have 600 permissions");
    }

    #[test]
    fn test_config_path_uses_primary_env_var() {
        let _guard = TestConfigGuard::new();

        let path = MowsConfig::config_path().expect("Failed to get config path");
        let env_path = std::env::var(MOWS_CONFIG_PATH_ENV).expect("MOWS_CONFIG_PATH env var not set");

        assert_eq!(path.to_str().unwrap(), env_path);
    }

    #[test]
    fn test_config_path_falls_back_to_legacy_env_var() {
        let _guard = TestConfigGuard::new();

        // Remove primary, set legacy
        let temp = tempfile::NamedTempFile::new().unwrap();
        std::env::remove_var(MOWS_CONFIG_PATH_ENV);
        std::env::set_var(MPM_CONFIG_PATH_ENV, temp.path());

        let path = MowsConfig::config_path().expect("Failed to get config path");
        assert_eq!(path, temp.path());
    }

    #[test]
    fn test_config_migration_from_legacy_file() {
        let _guard = TestConfigGuard::new();

        // Create a temporary HOME directory with legacy config
        let tmp_home = tempfile::tempdir().unwrap();
        let config_dir = tmp_home.path().join(".config/mows.cloud");
        fs::create_dir_all(&config_dir).unwrap();

        let legacy_path = config_dir.join(LEGACY_CONFIG_FILENAME);
        let new_path = config_dir.join(CONFIG_FILENAME);

        // Write a valid config to the legacy path
        fs::write(
            &legacy_path,
            "compose:\n  projects:\n    - projectName: migrated\n      repoPath: /migrated\n      manifestPath: .\n",
        )
        .unwrap();

        // Remove env var overrides so config_path() exercises the migration logic
        std::env::remove_var(MOWS_CONFIG_PATH_ENV);
        std::env::remove_var(MPM_CONFIG_PATH_ENV);
        std::env::set_var("HOME", tmp_home.path());

        let resolved = MowsConfig::config_path().unwrap();

        // Migration should have renamed legacy -> new
        assert_eq!(resolved, new_path);
        assert!(new_path.exists(), "New config file should exist after migration");
        assert!(!legacy_path.exists(), "Legacy config file should be gone after migration");

        // Verify content survived the migration
        let content = fs::read_to_string(&new_path).unwrap();
        assert!(content.contains("migrated"));
    }

    #[test]
    fn test_config_migration_skipped_when_new_file_exists() {
        let _guard = TestConfigGuard::new();

        let tmp_home = tempfile::tempdir().unwrap();
        let config_dir = tmp_home.path().join(".config/mows.cloud");
        fs::create_dir_all(&config_dir).unwrap();

        let legacy_path = config_dir.join(LEGACY_CONFIG_FILENAME);
        let new_path = config_dir.join(CONFIG_FILENAME);

        // Both files exist - migration should NOT overwrite the new one
        fs::write(&legacy_path, "compose:\n  projects: []\n").unwrap();
        fs::write(&new_path, "compose:\n  projects:\n    - projectName: keep-me\n      repoPath: /keep\n      manifestPath: .\n").unwrap();

        std::env::remove_var(MOWS_CONFIG_PATH_ENV);
        std::env::remove_var(MPM_CONFIG_PATH_ENV);
        std::env::set_var("HOME", tmp_home.path());

        let resolved = MowsConfig::config_path().unwrap();

        assert_eq!(resolved, new_path);
        // Legacy file should still exist (not removed)
        assert!(legacy_path.exists(), "Legacy file should not be touched");
        // New file should have original content
        let content = fs::read_to_string(&new_path).unwrap();
        assert!(content.contains("keep-me"));
    }

    #[test]
    fn test_config_no_migration_when_no_legacy_file() {
        let _guard = TestConfigGuard::new();

        let tmp_home = tempfile::tempdir().unwrap();
        let config_dir = tmp_home.path().join(".config/mows.cloud");
        fs::create_dir_all(&config_dir).unwrap();

        let new_path = config_dir.join(CONFIG_FILENAME);

        // Neither file exists - should just return new path
        std::env::remove_var(MOWS_CONFIG_PATH_ENV);
        std::env::remove_var(MPM_CONFIG_PATH_ENV);
        std::env::set_var("HOME", tmp_home.path());

        let resolved = MowsConfig::config_path().unwrap();
        assert_eq!(resolved, new_path);
    }

    #[test]
    fn test_config_multiple_projects_roundtrip() {
        let _guard = TestConfigGuard::new();

        let mut config = MowsConfig::default();

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

        let loaded = MowsConfig::load().expect("Failed to load config");

        assert_eq!(loaded.compose.projects.len(), 3);

        // Verify we can find all projects
        assert_eq!(loaded.find_projects("project-a").len(), 2);
        assert_eq!(loaded.find_projects("project-b").len(), 1);
        assert!(loaded.find_project("project-a", Some("staging")).is_some());
    }

    #[test]
    fn test_concurrent_save_operations() {
        use std::thread;

        let _guard = TestConfigGuard::new();

        // Start with empty config
        MowsConfig::default().save_without_lock().unwrap();

        let num_threads = 4;
        let iterations = 10;
        let handles: Vec<_> = (0..num_threads)
            .map(|thread_id| {
                thread::spawn(move || {
                    for i in 0..iterations {
                        // Use with_locked to ensure atomic read-modify-write
                        MowsConfig::with_locked(|config| {
                            config.upsert_project(ProjectEntry {
                                project_name: format!("project-{}-{}", thread_id, i),
                                instance_name: None,
                                repo_path: PathBuf::from(format!("/tmp/project-{}-{}", thread_id, i)),
                                manifest_path: PathBuf::from("."),
                            });
                            Ok(())
                        })
                        .unwrap();
                    }
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().expect("Thread panicked");
        }

        // Verify all entries were preserved (no data loss)
        let final_config = MowsConfig::load().expect("Failed to load final config");
        let expected_count = num_threads * iterations;
        assert_eq!(
            final_config.compose.projects.len(),
            expected_count,
            "All {} entries should be preserved with atomic updates",
            expected_count
        );
    }

    #[test]
    fn test_concurrent_load_operations() {
        use std::thread;

        let _guard = TestConfigGuard::new();

        // Create a config with multiple projects
        let mut config = MowsConfig::default();
        for i in 0..10 {
            config.upsert_project(ProjectEntry {
                project_name: format!("project-{}", i),
                instance_name: None,
                repo_path: PathBuf::from(format!("/tmp/project-{}", i)),
                manifest_path: PathBuf::from("."),
            });
        }
        config.save().unwrap();

        let num_threads = 8;
        let iterations = 20;
        let handles: Vec<_> = (0..num_threads)
            .map(|_| {
                thread::spawn(move || {
                    for _ in 0..iterations {
                        let config = MowsConfig::load().expect("Concurrent load failed");
                        // Verify we can read the config correctly
                        assert_eq!(config.compose.projects.len(), 10);
                    }
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().expect("Thread panicked");
        }
    }

    #[test]
    fn test_file_locking_prevents_corruption() {
        use std::sync::{Arc, Barrier};
        use std::thread;

        let _guard = TestConfigGuard::new();

        // Start with a config
        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "original".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/tmp/original"),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let num_threads = 4;
        let barrier = Arc::new(Barrier::new(num_threads));

        let handles: Vec<_> = (0..num_threads)
            .map(|thread_id| {
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    // Sync all threads to start at the same time
                    barrier.wait();

                    // Perform a read-modify-write operation
                    let mut config = MowsConfig::load().unwrap();
                    config.upsert_project(ProjectEntry {
                        project_name: format!("thread-{}", thread_id),
                        instance_name: None,
                        repo_path: PathBuf::from(format!("/tmp/thread-{}", thread_id)),
                        manifest_path: PathBuf::from("."),
                    });
                    config.save().unwrap();
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().expect("Thread panicked");
        }

        // Verify file is not corrupted - should parse correctly
        let final_config = MowsConfig::load().expect("Config file corrupted");
        // Original project should still exist
        assert!(final_config.find_project("original", None).is_some());
        // At least one thread's project should exist (others may have been overwritten)
        let thread_projects: Vec<_> = final_config
            .compose
            .projects
            .iter()
            .filter(|p| p.project_name.starts_with("thread-"))
            .collect();
        assert!(!thread_projects.is_empty(), "At least one thread project should exist");
    }

    #[test]
    fn test_with_locked_atomic_update() {
        let _guard = TestConfigGuard::new();

        // Initial save with a project
        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "initial".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/path/to/initial"),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        // Use with_locked to atomically update
        MowsConfig::with_locked(|config| {
            config.upsert_project(ProjectEntry {
                project_name: "added-via-with-locked".to_string(),
                instance_name: None,
                repo_path: PathBuf::from("/path/to/new"),
                manifest_path: PathBuf::from("."),
            });
            Ok(())
        })
        .expect("with_locked should succeed");

        // Verify both projects exist
        let loaded = MowsConfig::load().expect("Failed to load config");
        assert!(loaded.find_project("initial", None).is_some());
        assert!(loaded.find_project("added-via-with-locked", None).is_some());
    }

    #[test]
    fn test_with_locked_error_does_not_save() {
        use crate::error::MowsError;

        let _guard = TestConfigGuard::new();

        // Initial save with a project
        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "initial".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/path/to/initial"),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        // Use with_locked but return an error - changes should NOT be saved
        let result = MowsConfig::with_locked(|config| {
            config.upsert_project(ProjectEntry {
                project_name: "should-not-persist".to_string(),
                instance_name: None,
                repo_path: PathBuf::from("/path/to/new"),
                manifest_path: PathBuf::from("."),
            });
            Err(MowsError::Validation("Intentional error".to_string()))
        });

        assert!(result.is_err());

        // Verify the new project was NOT saved (due to error)
        let loaded = MowsConfig::load().expect("Failed to load config");
        assert!(loaded.find_project("initial", None).is_some());
        assert!(
            loaded.find_project("should-not-persist", None).is_none(),
            "Project should not be saved when closure returns error"
        );
    }
}
