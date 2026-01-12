mod cd;
mod checks;
pub mod config;
mod init;
mod install;
mod manifest;
mod passthrough;
mod render;
mod secrets;
mod up;
mod update;

pub use cd::compose_cd;
pub use init::compose_init;
pub use install::compose_install;
pub use passthrough::compose_passthrough;
pub use secrets::secrets_regenerate;
pub use up::compose_up;
pub use update::compose_update;

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::utils::find_git_root;

/// Find the first mows-manifest.yaml/yml file in a directory tree
/// Searches up to 5 levels deep, skipping hidden directories
pub(crate) fn find_manifest_in_repo(repo_dir: &Path) -> Result<PathBuf, String> {
    let manifests = find_all_manifests_in_repo(repo_dir);
    manifests.into_iter().next().ok_or_else(|| {
        format!("No mows-manifest.yaml found in '{}'", repo_dir.display())
    })
}

/// Find all mows-manifest.yaml/yml files in a directory tree
fn find_all_manifests_in_repo(repo_dir: &Path) -> Vec<PathBuf> {
    let mut manifests = Vec::new();

    for entry in WalkDir::new(repo_dir)
        .min_depth(0)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            // Skip hidden directories
            !e.file_name()
                .to_str()
                .map(|s| s.starts_with('.'))
                .unwrap_or(false)
        })
        .flatten()
    {
        let name = entry.file_name().to_string_lossy();
        if name == "mows-manifest.yaml" || name == "mows-manifest.yml" {
            manifests.push(entry.path().to_path_buf());
        }
    }

    manifests
}

/// Check if a directory contains a mows-manifest.yaml/yml
fn has_manifest(dir: &Path) -> bool {
    dir.join("mows-manifest.yaml").exists() || dir.join("mows-manifest.yml").exists()
}

/// Find the manifest directory for compose commands
///
/// 1. If current directory contains a manifest, use it
/// 2. Otherwise, find the git root and search for manifests
/// 3. If exactly one manifest is found in the repo, use its directory
/// 4. If zero or more than one, return an error
pub(crate) fn find_manifest_dir() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    // Check if current directory has a manifest
    if has_manifest(&current_dir) {
        return Ok(current_dir);
    }

    // Try to find git root and search for manifests
    let git_root = find_git_root()?;
    let manifests = find_all_manifests_in_repo(&git_root);

    match manifests.len() {
        0 => Err("No mows-manifest.yaml found in repository".to_string()),
        1 => {
            let manifest_dir = manifests[0]
                .parent()
                .ok_or("Invalid manifest path")?
                .to_path_buf();
            Ok(manifest_dir)
        }
        n => Err(format!(
            "Found {} mows-manifest.yaml files in repository. \
             Please run from the directory containing the manifest you want to use:\n{}",
            n,
            manifests
                .iter()
                .map(|p| format!("  - {}", p.display()))
                .collect::<Vec<_>>()
                .join("\n")
        )),
    }
}
