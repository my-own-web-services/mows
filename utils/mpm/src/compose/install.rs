use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{debug, info};

use crate::error::{IoResultExt, MpmError, Result};
use super::config::{MpmConfig, ProjectEntry};
use super::find_manifest_in_repo;
use super::manifest::MowsManifest;

/// Validate and sanitize a git URL
fn validate_git_url(url: &str) -> Result<()> {
    let url = url.trim();

    // Check for empty URL
    if url.is_empty() {
        return Err(MpmError::Validation("URL cannot be empty".to_string()));
    }

    // Check for valid URL schemes
    let valid_schemes = ["https://", "http://", "git://", "ssh://", "git@"];
    let has_valid_scheme = valid_schemes.iter().any(|s| url.starts_with(s));

    if !has_valid_scheme {
        return Err(MpmError::Validation(format!(
            "Invalid URL scheme. URL must start with one of: {}",
            valid_schemes.join(", ")
        )));
    }

    // Reject file:// URLs (security risk)
    if url.starts_with("file://") {
        return Err(MpmError::Validation("file:// URLs are not supported for security reasons".to_string()));
    }

    // Check for shell injection characters
    let dangerous_chars = ['`', '$', '(', ')', ';', '&', '|', '\n', '\r'];
    if url.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(MpmError::Validation("URL contains invalid characters".to_string()));
    }

    Ok(())
}

/// Sanitize repository name to prevent path traversal
fn sanitize_repo_name(name: &str) -> Result<String> {
    // Remove any path components
    let name = name.trim();

    // Reject empty names
    if name.is_empty() {
        return Err(MpmError::Validation("Repository name cannot be empty".to_string()));
    }

    // Reject path traversal attempts
    if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
        return Err(MpmError::Validation("Invalid repository name: path traversal detected".to_string()));
    }

    // Only allow safe characters: alphanumeric, dash, underscore, dot
    let sanitized: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();

    if sanitized.is_empty() {
        return Err(MpmError::Validation("Repository name contains no valid characters".to_string()));
    }

    // Don't allow names that are just dots
    if sanitized.chars().all(|c| c == '.') {
        return Err(MpmError::Validation("Invalid repository name".to_string()));
    }

    Ok(sanitized)
}

/// Install a mpm repo from a URL
pub fn compose_install(url: &str, target: Option<&Path>) -> Result<()> {
    // Validate URL before doing anything
    validate_git_url(url)?;

    let target_dir = target
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    info!("Installing from {} to {}", url, target_dir.display());

    // Extract and sanitize repo name from URL
    let repo_name = extract_repo_name(url)?;
    let repo_name = sanitize_repo_name(&repo_name)?;
    let clone_dir = target_dir.join(&repo_name);

    if clone_dir.exists() {
        return Err(MpmError::path(&clone_dir,
            "Directory already exists. Remove it first or choose a different target.",
        ));
    }

    // Clone repository (keeps .git for updates via git pull)
    clone_repo(url, &clone_dir)?;

    // Find the manifest file
    let manifest_path = find_manifest_in_repo(&clone_dir)?;
    let manifest_dir = manifest_path.parent().unwrap_or(&clone_dir);

    info!("Found manifest at: {}", manifest_path.display());

    // Load the manifest to get the project name
    let manifest = MowsManifest::load(manifest_dir)?;
    let project_name = manifest.project_name();

    // Calculate relative manifest path from repo root
    let relative_manifest_path = manifest_dir
        .strip_prefix(&clone_dir)
        .unwrap_or(Path::new("."))
        .to_path_buf();

    // Update global config
    let mut config = MpmConfig::load()?;
    config.upsert_project(ProjectEntry {
        project_name: project_name.to_string(),
        instance_name: None,
        repo_path: clone_dir.canonicalize()
            .io_context(format!("Failed to get absolute path for repo '{}'", clone_dir.display()))?,
        manifest_path: if relative_manifest_path.as_os_str().is_empty() {
            PathBuf::from(".")
        } else {
            relative_manifest_path.clone()
        },
    });
    config.save()?;

    info!("Installed project '{}' successfully", project_name);

    // Print instructions for entering the project directory
    println!();
    println!("To enter the project directory, run:");
    println!("  cd {}", manifest_dir.display());

    Ok(())
}

/// Extract repository name from URL
fn extract_repo_name(url: &str) -> Result<String> {
    // Handle various URL formats:
    // https://github.com/user/repo.git
    // git@github.com:user/repo.git
    // https://github.com/user/repo

    let url = url.trim_end_matches('/');
    let url = url.strip_suffix(".git").unwrap_or(url);

    url.rsplit('/')
        .next()
        .or_else(|| url.rsplit(':').next())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| MpmError::Validation(format!("Could not extract repository name from URL: {}", url)))
}

/// Clone a repository (keeps .git for updates via git pull)
fn clone_repo(url: &str, target: &Path) -> Result<()> {
    debug!("Cloning {} to {}", url, target.display());

    let output = Command::new("git")
        .args(["clone", url])
        .arg(target)
        .output()
        .map_err(|e| MpmError::command("git clone", e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MpmError::Git(format!("git clone failed: {}", stderr.trim())));
    }

    // Disable git hooks to prevent arbitrary code execution from cloned repos
    let hook_result = Command::new("git")
        .args(["config", "core.hooksPath", "/dev/null"])
        .current_dir(target)
        .output();

    if let Err(e) = hook_result {
        debug!("Warning: Failed to disable git hooks: {}", e);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name_https() {
        assert_eq!(
            extract_repo_name("https://github.com/user/my-project.git").unwrap(),
            "my-project"
        );
    }

    #[test]
    fn test_extract_repo_name_https_no_git() {
        assert_eq!(
            extract_repo_name("https://github.com/user/my-project").unwrap(),
            "my-project"
        );
    }

    #[test]
    fn test_extract_repo_name_ssh() {
        assert_eq!(
            extract_repo_name("git@github.com:user/my-project.git").unwrap(),
            "my-project"
        );
    }

    #[test]
    fn test_extract_repo_name_trailing_slash() {
        assert_eq!(
            extract_repo_name("https://github.com/user/my-project/").unwrap(),
            "my-project"
        );
    }
}
