mod cd;
mod checks;
pub mod config;
pub mod docker;
mod init;
mod install;
mod manifest;
mod passthrough;
mod render;
mod secrets;
mod up;
mod update;

pub use cd::compose_cd;
pub use docker::{
    check_docker_available, default_client, BollardDockerClient, CommandOutput,
    ComposePassthroughOptions, ComposeUpOptions, DockerClient, MockDockerClient,
    ENV_MOCK_DOCKER,
};
#[cfg(test)]
pub use docker::{ConfigurableMockClient, MockResponse};
pub use init::compose_init;
pub use install::compose_install;
pub use passthrough::compose_passthrough;
pub use secrets::secrets_regenerate;
pub use up::compose_up;
pub use update::compose_update;

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::error::{IoResultExt, MpmError, Result};
use crate::utils::find_git_root;

/// Find the first mows-manifest.yaml/yml file in a directory tree
/// Searches up to 5 levels deep, skipping hidden directories
pub(crate) fn find_manifest_in_repo(repo_dir: &Path) -> Result<PathBuf> {
    let manifests = find_all_manifests_in_repo(repo_dir);
    manifests.into_iter().next().ok_or_else(|| {
        MpmError::Manifest(format!("No mows-manifest.yaml found in '{}'", repo_dir.display()))
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
/// Search order:
/// 1. Current directory (if it contains a manifest)
/// 2. Walk up parent directories looking for a manifest
/// 3. If in a git repo, search within the repo for manifests
///
/// This supports both:
/// - Installed projects (no .git directory) - uses parent directory search
/// - Development repos - uses git root search
pub(crate) fn find_manifest_dir() -> Result<PathBuf> {
    let current_dir = std::env::current_dir()
        .io_context("Failed to get current directory")?;

    // Check if current directory has a manifest
    if has_manifest(&current_dir) {
        return Ok(current_dir);
    }

    // Walk up parent directories looking for a manifest
    let mut search_dir = current_dir.as_path();
    while let Some(parent) = search_dir.parent() {
        if has_manifest(parent) {
            return Ok(parent.to_path_buf());
        }
        search_dir = parent;
    }

    // Try git root as fallback (for monorepos with multiple manifests)
    if let Ok(git_root) = find_git_root() {
        let manifests = find_all_manifests_in_repo(&git_root);

        match manifests.len() {
            0 => {}
            1 => {
                let manifest_dir = manifests[0]
                    .parent()
                    .ok_or_else(|| MpmError::path(&manifests[0], "Invalid manifest path"))?
                    .to_path_buf();
                return Ok(manifest_dir);
            }
            n => {
                return Err(MpmError::Manifest(format!(
                    "Found {} mows-manifest.yaml files in repository. \
                     Please run from the directory containing the manifest you want to use:\n{}",
                    n,
                    manifests
                        .iter()
                        .map(|p| format!("  - {}", p.display()))
                        .collect::<Vec<_>>()
                        .join("\n")
                )));
            }
        }
    }

    Err(MpmError::Manifest("No mows-manifest.yaml found. Run from a project directory or use 'mpm compose install' to add a project.".to_string()))
}
