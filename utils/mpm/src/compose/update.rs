use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{debug, info, warn};

use super::config::MpmConfig;
use super::find_manifest_dir;
use super::find_manifest_in_repo;
use super::manifest::MowsManifest;

/// Backup state for rollback on update failure
struct UpdateBackup {
    values_content: String,
    values_path: PathBuf,
    generated_secrets: Option<String>,
    provided_secrets: Option<String>,
    manifest_dir: PathBuf,
}

impl UpdateBackup {
    /// Restore from backup on failure
    fn restore(self) -> Result<(), String> {
        warn!("Update failed, restoring previous state...");

        // Restore values file
        fs::write(&self.values_path, &self.values_content)
            .map_err(|e| format!("Failed to restore values file: {}", e))?;

        // Restore secrets if they existed
        if let Some(secrets) = self.generated_secrets {
            let path = self.manifest_dir.join("results/generated-secrets.env");
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&path, secrets);
        }

        if let Some(secrets) = self.provided_secrets {
            let path = self.manifest_dir.join("provided-secrets.env");
            let _ = fs::write(&path, secrets);
        }

        info!("Previous state restored");
        Ok(())
    }
}

/// Update the repository and merge values
pub fn compose_update() -> Result<(), String> {
    let base_dir = find_manifest_dir()?;

    info!("Updating project in: {}", base_dir.display());

    // Find the repo root (look for .git directory)
    let repo_root = find_repo_root(&base_dir)?;
    debug!("Repository root: {}", repo_root.display());

    // Get current manifest location
    let current_manifest_path = find_manifest(&base_dir)?;
    let current_manifest_dir = current_manifest_path.parent().unwrap();
    debug!("Current manifest: {}", current_manifest_path.display());

    // Create backup for potential rollback
    let values_path = find_values_file(current_manifest_dir)
        .unwrap_or_else(|_| current_manifest_dir.join("values.yaml"));
    let values_backup = backup_file(current_manifest_dir, "values.yaml")
        .or_else(|_| backup_file(current_manifest_dir, "values.yml"))?;

    let backup = UpdateBackup {
        values_content: values_backup.clone(),
        values_path: values_path.clone(),
        generated_secrets: backup_file(
            &current_manifest_dir.join("results"),
            "generated-secrets.env",
        ).ok(),
        provided_secrets: backup_file(current_manifest_dir, "provided-secrets.env").ok(),
        manifest_dir: current_manifest_dir.to_path_buf(),
    };

    // Run the update with rollback on failure
    match do_update(&base_dir, &repo_root, current_manifest_dir, &values_backup) {
        Ok(()) => Ok(()),
        Err(e) => {
            // Attempt rollback
            if let Err(restore_err) = backup.restore() {
                return Err(format!(
                    "Update failed: {}\nAdditionally, failed to restore previous state: {}",
                    e, restore_err
                ));
            }
            Err(e)
        }
    }
}

/// Inner update implementation
fn do_update(
    base_dir: &Path,
    repo_root: &Path,
    current_manifest_dir: &Path,
    values_backup: &str,
) -> Result<(), String> {
    // Pull latest changes
    git_pull(repo_root)?;

    // Find the new manifest location (might have moved)
    let new_manifest_path = match find_manifest(&base_dir) {
        Ok(p) => p,
        Err(_) => {
            // Manifest moved, search for it
            info!("Manifest not found at previous location, searching...");
            find_manifest_in_repo(&repo_root)?
        }
    };
    let new_manifest_dir = new_manifest_path.parent().unwrap();

    let manifest_moved = new_manifest_dir != current_manifest_dir;
    if manifest_moved {
        info!(
            "Manifest moved from {} to {}",
            current_manifest_dir.display(),
            new_manifest_dir.display()
        );
    }

    // Load new manifest
    let manifest = MowsManifest::load(new_manifest_dir)?;

    // Merge values.yaml
    let new_values_path = find_values_file(new_manifest_dir)?;
    let new_values_content = fs::read_to_string(&new_values_path)
        .map_err(|e| format!("Failed to read new values file: {}", e))?;

    let merged_values = merge_values(&values_backup, &new_values_content)?;
    fs::write(&new_values_path, &merged_values)
        .map_err(|e| format!("Failed to write merged values: {}", e))?;
    info!("Merged values.yaml");

    // If manifest moved, copy secrets to new location
    if manifest_moved {
        let new_results_dir = new_manifest_dir.join("results");
        fs::create_dir_all(&new_results_dir)
            .map_err(|e| format!("Failed to create results directory: {}", e))?;

        // Re-read secrets from current location (they were backed up before git pull)
        let generated_secrets = backup_file(
            &current_manifest_dir.join("results"),
            "generated-secrets.env",
        ).ok();
        let provided_secrets = backup_file(current_manifest_dir, "provided-secrets.env").ok();

        if let Some(ref secrets) = generated_secrets {
            let dest = new_results_dir.join("generated-secrets.env");
            fs::write(&dest, secrets)
                .map_err(|e| format!("Failed to copy generated-secrets.env: {}", e))?;
            info!("Copied generated-secrets.env to new location");
        }

        if let Some(ref secrets) = provided_secrets {
            let dest = new_manifest_dir.join("provided-secrets.env");
            fs::write(&dest, secrets)
                .map_err(|e| format!("Failed to copy provided-secrets.env: {}", e))?;
            info!("Copied provided-secrets.env to new location");
        }

        // Also handle data directory if it exists
        let old_data_dir = current_manifest_dir.join("data");
        let new_data_dir = new_manifest_dir.join("data");
        if old_data_dir.exists() && !new_data_dir.exists() {
            // Create symlink to old data directory to preserve data
            info!("Creating symlink to preserve data directory");
            std::os::unix::fs::symlink(&old_data_dir, &new_data_dir)
                .map_err(|e| format!("Failed to link data directory: {}", e))?;
        }

        // Update global config with new path
        let mut config = MpmConfig::load()?;
        let relative_path = new_manifest_dir
            .strip_prefix(repo_root)
            .unwrap_or(Path::new("."));
        if config.update_manifest_path(
            &manifest.project_name(),
            None,
            relative_path,
        ) {
            config.save()?;
            info!("Updated config with new manifest path");
        }
    }

    info!("Update completed successfully");
    if manifest_moved {
        println!("cd {}", new_manifest_dir.display());
    }

    Ok(())
}

/// Find the repository root by looking for .git directory
fn find_repo_root(start: &Path) -> Result<PathBuf, String> {
    let mut current = start.to_path_buf();

    loop {
        if current.join(".git").exists() {
            return Ok(current);
        }

        if !current.pop() {
            return Err("Not in a git repository".to_string());
        }
    }
}

/// Find the manifest file in the current or parent directories
fn find_manifest(start: &Path) -> Result<PathBuf, String> {
    let mut current = start.to_path_buf();

    loop {
        let yaml = current.join("mows-manifest.yaml");
        let yml = current.join("mows-manifest.yml");

        if yaml.exists() {
            return Ok(yaml);
        }
        if yml.exists() {
            return Ok(yml);
        }

        if !current.pop() {
            break;
        }
    }

    Err("No mows-manifest.yaml found".to_string())
}

/// Find the values file in a directory
fn find_values_file(dir: &Path) -> Result<PathBuf, String> {
    for name in &["values.yaml", "values.yml", "values.json"] {
        let path = dir.join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    Err(format!("No values file found in {}", dir.display()))
}

/// Backup a file's content
fn backup_file(dir: &Path, name: &str) -> Result<String, String> {
    let path = dir.join(name);
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to backup {}: {}", name, e))
}

/// Pull latest changes from git
fn git_pull(repo_root: &Path) -> Result<(), String> {
    info!("Pulling latest changes...");

    let output = Command::new("git")
        .args(["pull", "--ff-only"])
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("Failed to run git pull: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git pull failed: {}\nTry resolving conflicts manually.",
            stderr.trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    debug!("git pull output: {}", stdout);

    Ok(())
}

/// Merge values: keep existing keys, add new ones, comment out removed ones
fn merge_values(old_content: &str, new_content: &str) -> Result<String, String> {
    let old_value: serde_yaml::Value = serde_yaml::from_str(old_content)
        .map_err(|e| format!("Failed to parse old values: {}", e))?;
    let new_value: serde_yaml::Value = serde_yaml::from_str(new_content)
        .map_err(|e| format!("Failed to parse new values: {}", e))?;

    // Collect all keys from both files
    let old_keys = collect_keys(&old_value, "");
    let new_keys = collect_keys(&new_value, "");

    // Find keys that are in old but not in new (deprecated)
    let deprecated_keys: HashSet<_> = old_keys.difference(&new_keys).collect();

    // Merge: new as base, override with old values
    let merged = merge_yaml_values(new_value, old_value.clone());

    // Serialize
    let mut output = serde_yaml::to_string(&merged)
        .map_err(|e| format!("Failed to serialize merged values: {}", e))?;

    // Add deprecated keys as comments at the end
    if !deprecated_keys.is_empty() {
        output.push_str("\n# The following keys are no longer used in the new version:\n");
        for key in deprecated_keys {
            if let Some(value) = get_value_at_path(&old_value, key) {
                let value_str = serde_yaml::to_string(&value).unwrap_or_default();
                for line in value_str.lines() {
                    output.push_str(&format!("# {}: {}\n", key, line.trim()));
                }
            }
        }
    }

    Ok(output)
}

/// Collect all leaf keys from a YAML value with dot notation
fn collect_keys(value: &serde_yaml::Value, prefix: &str) -> HashSet<String> {
    let mut keys = HashSet::new();

    match value {
        serde_yaml::Value::Mapping(map) => {
            for (k, v) in map {
                let key_str = k.as_str().unwrap_or("");
                let full_key = if prefix.is_empty() {
                    key_str.to_string()
                } else {
                    format!("{}.{}", prefix, key_str)
                };

                if v.is_mapping() {
                    keys.extend(collect_keys(v, &full_key));
                } else {
                    keys.insert(full_key);
                }
            }
        }
        _ => {
            if !prefix.is_empty() {
                keys.insert(prefix.to_string());
            }
        }
    }

    keys
}

/// Get value at a dot-notation path
fn get_value_at_path<'a>(value: &'a serde_yaml::Value, path: &str) -> Option<&'a serde_yaml::Value> {
    let mut current = value;

    for part in path.split('.') {
        current = current.get(part)?;
    }

    Some(current)
}

/// Deep merge YAML values: new_base with old_override taking precedence
fn merge_yaml_values(
    new_base: serde_yaml::Value,
    old_override: serde_yaml::Value,
) -> serde_yaml::Value {
    match (new_base, old_override) {
        (serde_yaml::Value::Mapping(mut new_map), serde_yaml::Value::Mapping(old_map)) => {
            for (k, old_v) in old_map {
                if let Some(new_v) = new_map.remove(&k) {
                    // Key exists in both - merge recursively
                    new_map.insert(k, merge_yaml_values(new_v, old_v));
                } else {
                    // Key only in old - it will be handled as deprecated
                    // Don't include it in the merged output
                }
            }
            serde_yaml::Value::Mapping(new_map)
        }
        // For non-mappings, prefer old value
        (_, old) => old,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_values_preserves_existing() {
        let old = r#"
hostname: my-custom-host.com
port: 9000
debug: true
"#;
        let new = r#"
hostname: example.com
port: 8080
newOption: default
"#;

        let merged = merge_values(old, new).unwrap();

        // Should preserve old values
        assert!(merged.contains("my-custom-host.com"));
        assert!(merged.contains("9000"));

        // Should include new keys
        assert!(merged.contains("newOption"));

        // Should comment out deprecated keys
        assert!(merged.contains("# debug:"));
    }

    #[test]
    fn test_merge_values_nested() {
        let old = r#"
services:
  web:
    port: 3000
    replicas: 3
"#;
        let new = r#"
services:
  web:
    port: 8080
    memory: 512m
"#;

        let merged = merge_values(old, new).unwrap();

        // Should preserve nested old values
        assert!(merged.contains("3000") || merged.contains("port: 3000"));

        // Should include new nested keys
        assert!(merged.contains("memory"));
    }

    #[test]
    fn test_collect_keys() {
        let value: serde_yaml::Value = serde_yaml::from_str(
            r#"
a: 1
b:
  c: 2
  d:
    e: 3
"#,
        )
        .unwrap();

        let keys = collect_keys(&value, "");
        assert!(keys.contains("a"));
        assert!(keys.contains("b.c"));
        assert!(keys.contains("b.d.e"));
    }
}
