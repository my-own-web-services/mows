use reqwest::blocking::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

const GITHUB_API_URL: &str = "https://api.github.com/repos/my-own-web-services/mows/releases";
const GITHUB_RELEASES_URL: &str = "https://github.com/my-own-web-services/mows/releases/download";
const REPO_URL: &str = "https://github.com/my-own-web-services/mows.git";

/// Trusted SSH signing key for verifying release tags
const TRUSTED_SSH_KEY: &str = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ80+F8Xr3QAvxy/asB5QbB17m2vl+Aj+PzUZeatindf";

/// HTTP request timeout in seconds
const HTTP_TIMEOUT_SECS: u64 = 30;

/// GitHub release API response
#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
}

/// Create an HTTP client with appropriate timeouts and headers
fn create_http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(10))
        .user_agent(format!("mpm/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

/// Get the current architecture string for binary naming
fn get_arch() -> Result<&'static str, String> {
    match std::env::consts::ARCH {
        "x86_64" => Ok("amd64"),
        "aarch64" => Ok("arm64"),
        arch => Err(format!("Unsupported architecture: {}", arch)),
    }
}

/// Get the current OS string for binary naming
fn get_os() -> Result<&'static str, String> {
    match std::env::consts::OS {
        "linux" => Ok("linux"),
        "macos" => Ok("darwin"),
        os => Err(format!("Unsupported operating system: {}", os)),
    }
}

/// Fetch the latest mpm release version from GitHub API
fn fetch_latest_version() -> Result<String, String> {
    let client = create_http_client()?;
    let url = format!("{}/latest", GITHUB_API_URL);

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch latest release: HTTP {}",
            response.status()
        ));
    }

    let release: GithubRelease = response
        .json()
        .map_err(|e| format!("Failed to parse GitHub API response: {}", e))?;

    // Extract version from tag like "mpm-v0.2.0"
    release
        .tag_name
        .strip_prefix("mpm-v")
        .map(|v| v.to_string())
        .ok_or_else(|| {
            format!(
                "Unexpected tag format: {} (expected mpm-vX.Y.Z)",
                release.tag_name
            )
        })
}

/// Fetch release info for a specific version or latest
fn fetch_release_info(version: Option<&str>) -> Result<(String, String), String> {
    let version = match version {
        Some(v) => v.to_string(),
        None => fetch_latest_version()?,
    };

    let arch = get_arch()?;
    let os = get_os()?;

    let binary_name = format!("mpm-{}-{}-{}", version, os, arch);
    let download_url = format!("{}/mpm-v{}/{}", GITHUB_RELEASES_URL, version, binary_name);

    Ok((version, download_url))
}

/// Download a file from URL to a path
fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = create_http_client()?;

    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Failed to download {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download {}: HTTP {}",
            url,
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let mut file =
        File::create(dest).map_err(|e| format!("Failed to create file {}: {}", dest.display(), e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file {}: {}", dest.display(), e))?;

    Ok(())
}

/// Calculate SHA256 checksum of a file
fn calculate_checksum(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Verify the checksum of a downloaded binary
fn verify_checksum(binary_path: &Path, checksum_url: &str) -> Result<(), String> {
    let checksum_path = binary_path.with_extension("checksum");

    download_file(checksum_url, &checksum_path)?;

    // Read expected checksum from file (format: "hash  filename")
    let checksum_content =
        fs::read_to_string(&checksum_path).map_err(|e| format!("Failed to read checksum file: {}", e))?;

    let expected_checksum = checksum_content
        .split_whitespace()
        .next()
        .ok_or("Invalid checksum file format")?
        .to_lowercase();

    // Clean up checksum file
    let _ = fs::remove_file(&checksum_path);

    // Calculate actual checksum
    let actual_checksum = calculate_checksum(binary_path)?;

    if actual_checksum != expected_checksum {
        return Err(format!(
            r#"Checksum verification failed!
Expected: {}
Actual:   {}"#,
            expected_checksum, actual_checksum
        ));
    }

    Ok(())
}

/// Get the path to the currently running binary
fn get_current_binary_path() -> Result<PathBuf, String> {
    env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))
}

/// Replace the current binary with the new one
fn replace_binary(new_binary: &Path, current_binary: &Path) -> Result<(), String> {
    // Create backup of current binary
    let backup_path = current_binary.with_extension("backup");

    // Copy current binary to backup (in case we need to restore)
    fs::copy(current_binary, &backup_path)
        .map_err(|e| format!("Failed to create backup of current binary: {}", e))?;

    // Try to replace the binary
    let result = (|| -> Result<(), String> {
        // Remove the current binary
        fs::remove_file(current_binary)
            .map_err(|e| format!("Failed to remove current binary: {}", e))?;

        // Move new binary into place
        fs::rename(new_binary, current_binary)
            .map_err(|e| format!("Failed to install new binary: {}", e))?;

        // Set executable permissions
        let mut perms = fs::metadata(current_binary)
            .map_err(|e| format!("Failed to get binary metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(current_binary, perms)
            .map_err(|e| format!("Failed to set binary permissions: {}", e))?;

        Ok(())
    })();

    // If replacement failed, try to restore backup
    if let Err(e) = &result {
        eprintln!("Update failed, attempting to restore backup...");
        if let Err(restore_err) = fs::rename(&backup_path, current_binary) {
            eprintln!(
                "WARNING: Failed to restore backup: {}. Backup is at: {}",
                restore_err,
                backup_path.display()
            );
        } else {
            let _ = fs::remove_file(&backup_path);
        }
        return Err(e.clone());
    }

    // Clean up backup on success
    let _ = fs::remove_file(&backup_path);

    Ok(())
}

/// Download and verify the latest binary release
pub fn update_from_binary(version: Option<&str>) -> Result<(), String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let (new_version, download_url) = fetch_release_info(version)?;

    println!("Current version: {}", current_version);
    println!("Latest version:  {}", new_version);

    if version.is_none() && new_version == current_version {
        println!("Already up to date!");
        return Ok(());
    }

    let arch = get_arch()?;
    let os = get_os()?;
    let binary_name = format!("mpm-{}-{}-{}", new_version, os, arch);
    let checksum_url = format!(
        "{}/mpm-v{}/{}-checksum-sha256.txt",
        GITHUB_RELEASES_URL, new_version, binary_name
    );

    println!("Downloading mpm v{}...", new_version);

    // Create temp directory for download
    let temp_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let temp_binary = temp_dir.path().join("mpm-new");

    // Download the binary
    download_file(&download_url, &temp_binary)?;

    // Verify checksum
    println!("Verifying checksum...");
    verify_checksum(&temp_binary, &checksum_url)?;
    println!("Checksum verified successfully.");

    // Get current binary path
    let current_binary = get_current_binary_path()?;

    // Check if we have write permission
    if let Some(parent) = current_binary.parent() {
        if fs::metadata(parent)
            .map(|m| m.permissions().readonly())
            .unwrap_or(true)
        {
            return Err(format!(
                "Cannot update: no write permission to {}. Try running with sudo.",
                parent.display()
            ));
        }
    }

    // Replace binary
    println!("Installing new version...");
    replace_binary(&temp_binary, &current_binary)?;

    println!(
        "Successfully updated mpm from v{} to v{}",
        current_version, new_version
    );

    Ok(())
}

/// Clone repository, verify SSH signature, and build from source
pub fn update_from_source(version: Option<&str>) -> Result<(), String> {
    // Check required dependencies
    check_dependencies()?;

    println!("Building mpm from source...");

    // Create temp directory for the clone
    let temp_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let repo_path = temp_dir.path().join("mows");

    // Clone the repository
    println!("Cloning repository...");
    let repo_path_str = repo_path
        .to_str()
        .ok_or_else(|| "Invalid path: contains non-UTF8 characters".to_string())?;

    let output = Command::new("git")
        .args(["clone", "--depth", "100", REPO_URL, repo_path_str])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| format!("Failed to clone repository: {}", e))?;

    if !output.status.success() {
        return Err("Failed to clone repository".to_string());
    }

    // Determine which tag to use
    let target_tag = if let Some(v) = version {
        // User specified a version, construct the tag name
        let tag = format!("mpm-v{}", v);

        // Verify the tag exists
        let output = Command::new("git")
            .args(["tag", "-l", &tag])
            .current_dir(&repo_path)
            .output()
            .map_err(|e| format!("Failed to list tags: {}", e))?;

        let tags = String::from_utf8_lossy(&output.stdout);
        if tags.trim().is_empty() {
            return Err(format!("Version {} not found (tag {} does not exist)", v, tag));
        }

        tag
    } else {
        // Find the latest mpm tag
        let output = Command::new("git")
            .args(["tag", "-l", "mpm-v*", "--sort=-v:refname"])
            .current_dir(&repo_path)
            .output()
            .map_err(|e| format!("Failed to list tags: {}", e))?;

        let tags = String::from_utf8_lossy(&output.stdout);
        tags.lines()
            .next()
            .ok_or("No mpm release tags found in repository")?
            .to_string()
    };

    println!("Target release tag: {}", target_tag);

    // Verify SSH signature on the tag BEFORE checkout (security: prevents TOCTOU attacks)
    println!("Verifying SSH signature...");
    verify_ssh_signature(&repo_path, &target_tag)?;

    // Checkout the tag (now safe since signature is verified)
    let output = Command::new("git")
        .args(["checkout", &target_tag])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to checkout tag: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to checkout tag {}: {}",
            target_tag,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Build using Docker
    println!("Building with Docker...");
    let mpm_dir = repo_path.join("utils/mpm");

    let output = Command::new("./build.sh")
        .current_dir(&mpm_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| format!("Failed to run build script: {}", e))?;

    if !output.status.success() {
        return Err("Build failed".to_string());
    }

    // Get the built binary
    let new_binary = mpm_dir.join("dist/mpm");
    if !new_binary.exists() {
        return Err("Build completed but binary not found at dist/mpm".to_string());
    }

    // Get current binary path
    let current_binary = get_current_binary_path()?;
    let current_version = env!("CARGO_PKG_VERSION");

    // Extract version from tag
    let new_version = target_tag.strip_prefix("mpm-v").unwrap_or(&target_tag);

    println!("Current version: {}", current_version);
    println!("Built version:   {}", new_version);

    // Check if we have write permission
    if let Some(parent) = current_binary.parent() {
        if fs::metadata(parent)
            .map(|m| m.permissions().readonly())
            .unwrap_or(true)
        {
            return Err(format!(
                "Cannot update: no write permission to {}. Try running with sudo.",
                parent.display()
            ));
        }
    }

    // Replace binary
    println!("Installing new version...");
    replace_binary(&new_binary, &current_binary)?;

    println!(
        "Successfully built and installed mpm v{} from source",
        new_version
    );

    Ok(())
}

/// Check that required dependencies (git, docker) are available
fn check_dependencies() -> Result<(), String> {
    // Check git
    Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| "git is not installed or not in PATH")?;

    // Check docker
    Command::new("docker")
        .arg("--version")
        .output()
        .map_err(|_| "docker is not installed or not in PATH")?;

    // Check docker is running
    let output = Command::new("docker")
        .args(["info"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|_| "docker is not running")?;

    if !output.success() {
        return Err("docker daemon is not running".to_string());
    }

    Ok(())
}

/// Verify SSH signature on a git tag using the hardcoded trusted key
fn verify_ssh_signature(repo_path: &Path, tag: &str) -> Result<(), String> {
    use std::io::Write;

    // Create a temporary allowed_signers file with our trusted key
    let temp_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let allowed_signers_path = temp_dir.path().join("allowed_signers");

    // Format: <principal> <key-type> <key>
    // We use "*" as principal to match any email
    let allowed_signers_content = format!("* {}\n", TRUSTED_SSH_KEY);

    let mut file = File::create(&allowed_signers_path)
        .map_err(|e| format!("Failed to create allowed_signers file: {}", e))?;
    file.write_all(allowed_signers_content.as_bytes())
        .map_err(|e| format!("Failed to write allowed_signers file: {}", e))?;

    // Configure git to use our allowed_signers file for this verification
    let output = Command::new("git")
        .args([
            "-c",
            &format!(
                "gpg.ssh.allowedSignersFile={}",
                allowed_signers_path.display()
            ),
            "tag",
            "-v",
            tag,
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to verify tag signature: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        // Check if it's because the tag isn't signed
        if stderr.contains("error: no signature found") || stderr.contains("no signature") {
            return Err(format!(
                "Tag {} is not signed. Cannot verify authenticity.",
                tag
            ));
        }
        // Check for SSH signature format issues
        if stderr.contains("Bad signature") || stderr.contains("Could not verify signature") {
            return Err(format!(
                "SSH signature verification failed. The tag may have been signed with a different key.\n{}",
                stderr
            ));
        }
        return Err(format!(
            r#"Signature verification failed:
{}
{}"#,
            stdout, stderr
        ));
    }

    // Verify the signature was actually validated with our trusted key
    // Git outputs "Good signature" when verification succeeds
    if !stderr.contains("Good signature") && !stdout.contains("Good signature") {
        return Err(format!(
            r#"Signature verification did not confirm a good signature:
{}
{}"#,
            stdout, stderr
        ));
    }

    println!("SSH signature verified successfully.");
    Ok(())
}

/// Main self-update entry point
pub fn self_update(build: bool, version: Option<&str>) -> Result<(), String> {
    let result = if build {
        update_from_source(version)
    } else {
        update_from_binary(version)
    };

    // Clear update notification on successful update
    if result.is_ok() {
        if let Ok(mut config) = crate::compose::config::MpmConfig::load() {
            config.clear_update_notification();
            let _ = config.save();
        }
    }

    result
}

/// Spawn a background thread to check for updates without blocking
pub fn check_for_updates_background() {
    use crate::compose::config::MpmConfig;

    // Load config first to check if we should skip
    let config = match MpmConfig::load() {
        Ok(c) => c,
        Err(_) => return,
    };

    if !config.should_check_for_updates() {
        return;
    }

    std::thread::spawn(|| {
        check_and_save_update_info();
    });
}

/// Check for updates and save to config (runs in background thread)
fn check_and_save_update_info() {
    use crate::compose::config::MpmConfig;

    let current_version = env!("CARGO_PKG_VERSION");

    // Fetch latest version
    let latest_version = match fetch_latest_version() {
        Ok(v) => v,
        Err(_) => return, // Silently fail in background
    };

    // Load config, update, and save
    let mut config = match MpmConfig::load() {
        Ok(c) => c,
        Err(_) => return,
    };

    // Only notify if there's actually a newer version
    if latest_version != current_version && is_newer_version(&latest_version, current_version) {
        config.set_update_available(latest_version);
    } else {
        // Still update the checked_at timestamp by setting current version
        // This prevents re-checking when already up to date
        config.set_update_available(current_version.to_string());
    }

    let _ = config.save();
}

/// Compare semantic versions to check if `new` is newer than `current`
fn is_newer_version(new: &str, current: &str) -> bool {
    let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() != 3 {
            return None;
        }
        Some((
            parts[0].parse().ok()?,
            parts[1].parse().ok()?,
            parts[2].parse().ok()?,
        ))
    };

    match (parse_version(new), parse_version(current)) {
        (Some((new_major, new_minor, new_patch)), Some((cur_major, cur_minor, cur_patch))) => {
            (new_major, new_minor, new_patch) > (cur_major, cur_minor, cur_patch)
        }
        _ => false,
    }
}

/// Check config and print update notification if available
pub fn notify_if_update_available() {
    use crate::compose::config::MpmConfig;

    let config = match MpmConfig::load() {
        Ok(c) => c,
        Err(_) => return,
    };

    if let Some(update) = &config.update {
        let current_version = env!("CARGO_PKG_VERSION");
        if update.available_version != current_version
            && is_newer_version(&update.available_version, current_version)
        {
            eprintln!(
                "\x1b[33mA new version of mpm is available: {} (current: {})\x1b[0m",
                update.available_version, current_version
            );
            eprintln!("\x1b[33mRun 'mpm self-update' to update.\x1b[0m\n");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_version_major_bump() {
        assert!(is_newer_version("2.0.0", "1.0.0"));
        assert!(is_newer_version("10.0.0", "9.9.9"));
    }

    #[test]
    fn test_is_newer_version_minor_bump() {
        assert!(is_newer_version("1.1.0", "1.0.0"));
        assert!(is_newer_version("1.10.0", "1.9.0"));
    }

    #[test]
    fn test_is_newer_version_patch_bump() {
        assert!(is_newer_version("1.0.1", "1.0.0"));
        assert!(is_newer_version("1.0.10", "1.0.9"));
    }

    #[test]
    fn test_is_newer_version_same_version() {
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("2.5.3", "2.5.3"));
    }

    #[test]
    fn test_is_newer_version_older() {
        assert!(!is_newer_version("1.0.0", "2.0.0"));
        assert!(!is_newer_version("1.0.0", "1.1.0"));
        assert!(!is_newer_version("1.0.0", "1.0.1"));
    }

    #[test]
    fn test_is_newer_version_invalid_format() {
        // Invalid versions should return false (fail safe)
        assert!(!is_newer_version("invalid", "1.0.0"));
        assert!(!is_newer_version("1.0.0", "invalid"));
        assert!(!is_newer_version("1.0", "1.0.0"));
        assert!(!is_newer_version("1.0.0.0", "1.0.0"));
    }

    #[test]
    fn test_get_arch_returns_valid() {
        // Should return Ok on supported architectures
        let result = get_arch();
        // We're running on a supported arch if tests are running
        match std::env::consts::ARCH {
            "x86_64" => assert_eq!(result, Ok("amd64")),
            "aarch64" => assert_eq!(result, Ok("arm64")),
            _ => assert!(result.is_err()),
        }
    }

    #[test]
    fn test_get_os_returns_valid() {
        // Should return Ok on supported OS
        let result = get_os();
        match std::env::consts::OS {
            "linux" => assert_eq!(result, Ok("linux")),
            "macos" => assert_eq!(result, Ok("darwin")),
            _ => assert!(result.is_err()),
        }
    }

    #[test]
    fn test_calculate_checksum() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        // Create a temp file with known content
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"hello world").unwrap();
        file.flush().unwrap();

        let checksum = calculate_checksum(file.path()).unwrap();

        // SHA256 of "hello world" (without newline)
        assert_eq!(
            checksum,
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn test_calculate_checksum_empty_file() {
        use tempfile::NamedTempFile;

        let file = NamedTempFile::new().unwrap();
        let checksum = calculate_checksum(file.path()).unwrap();

        // SHA256 of empty content
        assert_eq!(
            checksum,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_calculate_checksum_nonexistent_file() {
        let result = calculate_checksum(Path::new("/nonexistent/file/path"));
        assert!(result.is_err());
    }

    #[test]
    fn test_create_http_client() {
        let client = create_http_client();
        assert!(client.is_ok());
    }
}
