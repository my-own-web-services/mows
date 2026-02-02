use colored::Colorize;
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

use crate::error::{IoResultExt, MowsError, Result};

const GITHUB_API_URL: &str = "https://api.github.com/repos/my-own-web-services/mows/releases";
const GITHUB_RELEASES_URL: &str = "https://github.com/my-own-web-services/mows/releases/download";
const REPO_URL: &str = "https://github.com/my-own-web-services/mows.git";

/// Trusted SSH signing key for verifying release tags
const TRUSTED_SSH_KEY: &str = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ80+F8Xr3QAvxy/asB5QbB17m2vl+Aj+PzUZeatindf";

/// HTTP request timeout in seconds for downloads
const HTTP_TIMEOUT_SECS: u64 = 30;

/// Short timeout for version check (should not delay CLI noticeably)
const VERSION_CHECK_TIMEOUT_SECS: u64 = 1;

/// Move a file, falling back to copy+delete if rename fails with cross-device error.
/// This handles the case where source and destination are on different filesystems
/// (e.g., /tmp is tmpfs while target is on a real disk).
fn move_file(src: &Path, dst: &Path) -> Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if e.raw_os_error() == Some(libc::EXDEV) => {
            // Cross-device link error - fall back to copy + delete
            fs::copy(src, dst)
                .io_context(format!("Failed to copy {} to {}", src.display(), dst.display()))?;
            fs::remove_file(src)
                .io_context(format!("Failed to remove {}", src.display()))?;
            Ok(())
        }
        Err(e) => Err(MowsError::io(
            format!("Failed to move {} to {}", src.display(), dst.display()),
            e,
        )),
    }
}

/// GitHub release API response
#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
}

/// Create an HTTP client with appropriate timeouts and headers for downloads
fn create_http_client() -> Result<Client> {
    Ok(Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(10))
        .user_agent(format!("mows/{}", env!("CARGO_PKG_VERSION")))
        .build()?)
}

/// Create an HTTP client with short timeout for background version checking
fn create_version_check_client() -> Result<Client> {
    Ok(Client::builder()
        .timeout(Duration::from_secs(VERSION_CHECK_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(VERSION_CHECK_TIMEOUT_SECS))
        .user_agent(format!("mows/{}", env!("CARGO_PKG_VERSION")))
        .build()?)
}

/// Get the current architecture string for binary naming
fn get_arch() -> Result<&'static str> {
    match std::env::consts::ARCH {
        "x86_64" => Ok("amd64"),
        "aarch64" => Ok("arm64"),
        arch => Err(MowsError::Message(format!("Unsupported architecture: {}", arch))),
    }
}

/// Get the current OS string for binary naming
fn get_os() -> Result<&'static str> {
    match std::env::consts::OS {
        "linux" => Ok("linux"),
        "macos" => Ok("darwin"),
        os => Err(MowsError::Message(format!("Unsupported operating system: {}", os))),
    }
}

/// Fetch the latest mows release version from GitHub API
fn fetch_latest_version() -> Result<String> {
    fetch_latest_version_with_client(create_http_client()?)
}

/// Fetch the latest version using a short timeout (for background checks)
fn fetch_latest_version_fast() -> Result<String> {
    fetch_latest_version_with_client(create_version_check_client()?)
}

/// Fetch the latest mows release version using the provided HTTP client
fn fetch_latest_version_with_client(client: Client) -> Result<String> {
    let url = format!("{}/latest", GITHUB_API_URL);

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()?;

    if !response.status().is_success() {
        return Err(MowsError::Message(format!(
            "Failed to fetch latest release: HTTP {}",
            response.status()
        )));
    }

    let release: GithubRelease = response.json()?;

    // Extract version from tag like "mows-cli-v0.2.0" and validate semver
    let version = release
        .tag_name
        .strip_prefix("mows-cli-v")
        .ok_or_else(|| {
            MowsError::Message(format!(
                "Unexpected tag format: {} (expected mows-cli-vX.Y.Z)",
                release.tag_name
            ))
        })?;

    if !is_valid_semver(version) {
        return Err(MowsError::Message(format!(
            "Invalid version in tag {}: '{}' is not a valid semver version",
            release.tag_name, version
        )));
    }

    Ok(version.to_string())
}

/// Fetch release info for a specific version or latest
fn fetch_release_info(version: Option<&str>) -> Result<(String, String)> {
    let version = match version {
        Some(v) => v.to_string(),
        None => fetch_latest_version()?,
    };

    let arch = get_arch()?;
    let os = get_os()?;

    let binary_name = format!("mows-{}-{}-{}", version, os, arch);
    let download_url = format!("{}/mows-cli-v{}/{}", GITHUB_RELEASES_URL, version, binary_name);

    Ok((version, download_url))
}

/// Download a file from URL to a path
fn download_file(url: &str, dest: &Path) -> Result<()> {
    let client = create_http_client()?;

    let response = client.get(url).send()?;

    if !response.status().is_success() {
        return Err(MowsError::Message(format!(
            "Failed to download {}: HTTP {}",
            url,
            response.status()
        )));
    }

    let bytes = response.bytes()?;

    let mut file =
        File::create(dest).io_context(format!("Failed to create file {}", dest.display()))?;

    file.write_all(&bytes)
        .io_context(format!("Failed to write file {}", dest.display()))?;

    Ok(())
}

/// Calculate SHA256 checksum of a file
fn calculate_checksum(path: &Path) -> Result<String> {
    let mut file = File::open(path).io_context(format!("Failed to open {}", path.display()))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .io_context(format!("Failed to read {}", path.display()))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Verify the checksum of a downloaded binary
fn verify_checksum(binary_path: &Path, checksum_url: &str) -> Result<()> {
    let checksum_path = binary_path.with_extension("checksum");

    download_file(checksum_url, &checksum_path)?;

    // Read expected checksum from file (format: "hash  filename")
    let checksum_content =
        fs::read_to_string(&checksum_path).io_context("Failed to read checksum file")?;

    let expected_checksum = checksum_content
        .split_whitespace()
        .next()
        .ok_or_else(|| MowsError::Message("Invalid checksum file format".to_string()))?
        .to_lowercase();

    // Clean up checksum file
    if let Err(e) = fs::remove_file(&checksum_path) {
        tracing::warn!("Failed to remove checksum file {}: {}", checksum_path.display(), e);
    }

    // Calculate actual checksum
    let actual_checksum = calculate_checksum(binary_path)?;

    if actual_checksum != expected_checksum {
        return Err(MowsError::Message(format!(
            r#"Checksum verification failed!
Expected: {}
Actual:   {}"#,
            expected_checksum, actual_checksum
        )));
    }

    Ok(())
}

/// Get the path to the currently running binary
fn get_current_binary_path() -> Result<PathBuf> {
    env::current_exe().io_context("Failed to get current executable path")
}

/// Replace the current binary with the new one
fn replace_binary(new_binary: &Path, current_binary: &Path) -> Result<()> {
    // Create backup of current binary
    let backup_path = current_binary.with_extension("backup");

    // Copy current binary to backup (in case we need to restore)
    fs::copy(current_binary, &backup_path)
        .io_context(format!("Failed to create backup at {}", backup_path.display()))?;

    // Try to replace the binary
    let result = (|| -> Result<()> {
        // Remove the current binary
        fs::remove_file(current_binary)
            .io_context(format!("Failed to remove current binary at {}", current_binary.display()))?;

        // Move new binary into place (handles cross-device link errors)
        move_file(new_binary, current_binary)?;

        // Set executable permissions
        let mut perms = fs::metadata(current_binary)
            .io_context(format!("Failed to get metadata for {}", current_binary.display()))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(current_binary, perms)
            .io_context(format!("Failed to set permissions on {}", current_binary.display()))?;

        Ok(())
    })();

    // If replacement failed, try to restore backup
    if let Err(e) = result {
        eprintln!("Update failed, attempting to restore backup...");
        if let Err(restore_err) = move_file(&backup_path, current_binary) {
            eprintln!(
                "WARNING: Failed to restore backup: {}. Backup is at: {}",
                restore_err,
                backup_path.display()
            );
        }
        return Err(e);
    }

    // Clean up backup on success
    if let Err(e) = fs::remove_file(&backup_path) {
        tracing::warn!("Failed to remove backup file {}: {}", backup_path.display(), e);
    }

    Ok(())
}

/// Create an `mpm` symlink alongside the `mows` binary if possible.
///
/// Creates a relative symlink `mpm -> mows` in the same directory,
/// so that `mpm` works as a shorthand alias for `mows package-manager`.
///
/// If a real (non-symlink) file already exists at the `mpm` path, this
/// function logs a warning and skips creation to avoid destroying an
/// existing binary. Returns Ok(()) in both cases.
fn create_mpm_symlink_if_possible(mows_binary: &Path) -> Result<()> {
    let parent = mows_binary
        .parent()
        .ok_or_else(|| MowsError::path(mows_binary, "Cannot determine parent directory"))?;
    let mpm_path = parent.join("mpm");

    let mows_filename = mows_binary
        .file_name()
        .ok_or_else(|| MowsError::path(mows_binary, "Cannot determine binary filename"))?;

    // Check existing file at the target path
    match mpm_path.symlink_metadata() {
        Ok(meta) if meta.file_type().is_symlink() => {
            // Remove stale symlink, then recreate below
            fs::remove_file(&mpm_path)
                .io_context(format!("Failed to remove old mpm symlink at {}", mpm_path.display()))?;
        }
        Ok(_) => {
            // It's a real file, not a symlink — warn the user and skip
            tracing::warn!(
                "Cannot create mpm symlink: {} exists and is not a symlink. \
                 Remove it manually if you want the mpm alias.",
                mpm_path.display()
            );
            return Ok(());
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Path does not exist — proceed to create symlink
        }
        Err(e) => {
            return Err(MowsError::io(format!("Failed to check mpm symlink at {}", mpm_path.display()), e));
        }
    }

    std::os::unix::fs::symlink(mows_filename, &mpm_path)
        .io_context(format!("Failed to create mpm symlink at {}", mpm_path.display()))?;

    // Verify the symlink points to the correct target
    match fs::read_link(&mpm_path) {
        Ok(target) if target == Path::new(mows_filename) => {
            println!("Created mpm symlink: {} -> {}", mpm_path.display(), mows_filename.to_string_lossy());
        }
        Ok(target) => {
            tracing::warn!(
                "mpm symlink created but points to '{}' instead of '{}'",
                target.display(),
                mows_filename.to_string_lossy()
            );
        }
        Err(e) => {
            tracing::warn!("Could not verify mpm symlink: {}", e);
        }
    }

    Ok(())
}

/// Download and verify the latest binary release
pub fn update_from_binary(version: Option<&str>) -> Result<()> {
    let current_version = env!("CARGO_PKG_VERSION");
    let (new_version, download_url) = fetch_release_info(version)?;

    println!("Current version: {}", current_version);
    println!("Latest version:  {}", new_version);

    if version.is_none() {
        if new_version == current_version {
            println!("{}", "Already up to date!".green().bold());
            return Ok(());
        }
        if !is_newer_version(&new_version, current_version) {
            println!(
                "Current version ({}) is newer than latest release ({}).",
                current_version, new_version
            );
            println!("No update available. Use --version to install a specific version.");
            return Ok(());
        }
    }

    let arch = get_arch()?;
    let os = get_os()?;
    let binary_name = format!("mows-{}-{}-{}", new_version, os, arch);
    let checksum_url = format!(
        "{}/mows-cli-v{}/{}-checksum-sha256.txt",
        GITHUB_RELEASES_URL, new_version, binary_name
    );

    println!("Downloading mows v{}...", new_version);

    // Create temp directory for download
    let temp_dir =
        tempfile::tempdir().io_context("Failed to create temp directory")?;
    let temp_binary = temp_dir.path().join("mows-new");

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
            return Err(MowsError::Message(format!(
                "Cannot update: no write permission to {}. Try running with sudo.",
                parent.display()
            )));
        }
    }

    // Replace binary
    println!("Installing new version...");
    replace_binary(&temp_binary, &current_binary)?;

    println!(
        "Successfully updated mows from v{} to v{}",
        current_version, new_version
    );

    // Ensure mpm symlink exists alongside the mows binary
    create_mpm_symlink_if_possible(&current_binary)?;

    // Update shell completions and man pages
    println!("Updating shell completions...");
    if let Err(e) = crate::shell_init::shell_init(true) {
        eprintln!("Warning: Failed to update shell completions: {}", e);
    }

    println!("Updating man pages...");
    if let Err(e) = crate::manpage::manpage(true) {
        eprintln!("Warning: Failed to update man pages: {}", e);
    }

    Ok(())
}

/// Clone repository, verify SSH signature, and build from source
pub fn update_from_source(version: Option<&str>) -> Result<()> {
    // Check required dependencies
    check_dependencies()?;

    println!("Building mows from source...");

    // Create temp directory for the clone
    let temp_dir =
        tempfile::tempdir().io_context("Failed to create temp directory")?;
    let repo_path = temp_dir.path().join("mows");

    // Clone the repository
    println!("Cloning repository...");
    let repo_path_str = repo_path
        .to_str()
        .ok_or_else(|| MowsError::Message("Invalid path: contains non-UTF8 characters".to_string()))?;

    let output = Command::new("git")
        .args(["clone", "--depth", "100", REPO_URL, repo_path_str])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| MowsError::command("git clone", e.to_string()))?;

    if !output.status.success() {
        return Err(MowsError::Message("Failed to clone repository".to_string()));
    }

    // Determine which tag to use
    let target_tag = if let Some(v) = version {
        // User specified a version, construct the tag name
        let tag = format!("mows-cli-v{}", v);

        // Verify the tag exists
        let output = Command::new("git")
            .args(["tag", "-l", &tag])
            .current_dir(&repo_path)
            .output()
            .map_err(|e| MowsError::command("git tag -l", e.to_string()))?;

        let tags = String::from_utf8_lossy(&output.stdout);
        if tags.trim().is_empty() {
            return Err(MowsError::Message(format!("Version {} not found (tag {} does not exist)", v, tag)));
        }

        tag
    } else {
        // Find the latest mows tag
        let output = Command::new("git")
            .args(["tag", "-l", "mows-cli-v*", "--sort=-v:refname"])
            .current_dir(&repo_path)
            .output()
            .map_err(|e| MowsError::command("git tag -l", e.to_string()))?;

        let tags = String::from_utf8_lossy(&output.stdout);
        tags.lines()
            .next()
            .ok_or_else(|| MowsError::Message("No mows release tags found in repository".to_string()))?
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
        .map_err(|e| MowsError::command("git checkout", e.to_string()))?;

    if !output.status.success() {
        return Err(MowsError::Message(format!(
            "Failed to checkout tag {}: {}",
            target_tag,
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    // Build using Docker
    println!("Building with Docker...");
    let mpm_dir = repo_path.join("utils/mows-cli");

    let output = Command::new("./build.sh")
        .current_dir(&mpm_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| MowsError::command("build.sh", e.to_string()))?;

    if !output.status.success() {
        return Err(MowsError::Message("Build failed".to_string()));
    }

    // Get the built binary
    let new_binary = mpm_dir.join("dist/mows");
    if !new_binary.exists() {
        return Err(MowsError::Message("Build completed but binary not found at dist/mows".to_string()));
    }

    // Get current binary path
    let current_binary = get_current_binary_path()?;
    let current_version = env!("CARGO_PKG_VERSION");

    // Extract version from tag
    let new_version = target_tag.strip_prefix("mows-cli-v").ok_or_else(|| {
        MowsError::Message(format!(
            "Unexpected tag format: {} (expected mows-cli-vX.Y.Z)",
            target_tag
        ))
    })?;

    println!("Current version: {}", current_version);
    println!("Built version:   {}", new_version);

    // Check if we have write permission
    if let Some(parent) = current_binary.parent() {
        if fs::metadata(parent)
            .map(|m| m.permissions().readonly())
            .unwrap_or(true)
        {
            return Err(MowsError::Message(format!(
                "Cannot update: no write permission to {}. Try running with sudo.",
                parent.display()
            )));
        }
    }

    // Replace binary
    println!("Installing new version...");
    replace_binary(&new_binary, &current_binary)?;

    println!(
        "Successfully built and installed mows v{} from source",
        new_version
    );

    // Ensure mpm symlink exists alongside the mows binary
    create_mpm_symlink_if_possible(&current_binary)?;

    // Update shell completions and man pages
    println!("Updating shell completions...");
    if let Err(e) = crate::shell_init::shell_init(true) {
        eprintln!("Warning: Failed to update shell completions: {}", e);
    }

    println!("Updating man pages...");
    if let Err(e) = crate::manpage::manpage(true) {
        eprintln!("Warning: Failed to update man pages: {}", e);
    }

    Ok(())
}

/// Check that required dependencies (git, docker) are available
fn check_dependencies() -> Result<()> {
    use crate::package_manager::compose::default_client;

    // Check git
    Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| MowsError::Message("git is not installed or not in PATH".to_string()))?;

    // Check docker using the DockerClient (which also verifies daemon is running)
    let client = default_client().map_err(|e| {
        MowsError::Message(format!("Docker is not available: {}", e))
    })?;

    client.check_daemon().map_err(|e| {
        MowsError::Message(format!("Docker daemon is not running: {}", e))
    })?;

    Ok(())
}

/// Verify SSH signature on a git tag using the hardcoded trusted key
fn verify_ssh_signature(repo_path: &Path, tag: &str) -> Result<()> {
    use std::io::Write;

    // Create a temporary allowed_signers file with our trusted key
    let temp_dir =
        tempfile::tempdir().io_context("Failed to create temp directory")?;
    let allowed_signers_path = temp_dir.path().join("allowed_signers");

    // Format: <principal> <key-type> <key>
    // We use "*" as principal to match any email
    let allowed_signers_content = format!("* {}\n", TRUSTED_SSH_KEY);

    let mut file = File::create(&allowed_signers_path)
        .io_context("Failed to create allowed_signers file")?;
    file.write_all(allowed_signers_content.as_bytes())
        .io_context("Failed to write allowed_signers file")?;
    drop(file); // Ensure file is flushed before verification reads it

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
        .map_err(|e| MowsError::command("ssh-keygen verify", e.to_string()))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        // Check if it's because the tag isn't signed
        if stderr.contains("error: no signature found") || stderr.contains("no signature") {
            return Err(MowsError::Message(format!(
                "Tag {} is not signed. Cannot verify authenticity.",
                tag
            )));
        }
        // Check for SSH signature format issues
        if stderr.contains("Bad signature") || stderr.contains("Could not verify signature") {
            return Err(MowsError::Message(format!(
                "SSH signature verification failed. The tag may have been signed with a different key.\n{}",
                stderr
            )));
        }
        return Err(MowsError::Message(format!(
            r#"Signature verification failed:
{}
{}"#,
            stdout, stderr
        )));
    }

    // Verify the signature was actually validated with our trusted key.
    // Git outputs specific formats that we check for to prevent spoofing via tag names/messages:
    // - SSH: 'Good "git" signature for'
    // - GPG: 'Good signature from'
    let combined_output = format!("{}{}", stdout, stderr);
    let has_good_signature = combined_output.contains(r#"Good "git" signature for"#)
        || combined_output.contains("Good signature from");
    if !has_good_signature {
        return Err(MowsError::Message(format!(
            r#"Signature verification did not confirm a good signature:
{}
{}"#,
            stdout, stderr
        )));
    }

    println!("SSH signature verified successfully.");
    Ok(())
}

/// Compute SHA256 hash of the currently running binary
fn get_self_hash() -> Result<String> {
    let binary_path = get_current_binary_path()?;
    let mut file = File::open(&binary_path)
        .io_context(format!("Failed to open binary at {}", binary_path.display()))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file.read(&mut buffer)
            .io_context(format!("Failed to read binary at {}", binary_path.display()))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let hash = hasher.finalize();
    Ok(format!("{:x}", hash))
}

/// Fetch expected checksum from GitHub releases for verification
fn fetch_expected_checksum(version: &str) -> Result<String> {
    let arch = get_arch()?;
    let os = get_os()?;
    let checksum_url = format!(
        "{}/mows-cli-v{}/mows-{}-{}-{}-checksum-sha256.txt",
        GITHUB_RELEASES_URL, version, version, os, arch
    );

    let client = create_version_check_client()?;
    let response = client.get(&checksum_url).send()?;

    if !response.status().is_success() {
        return Err(MowsError::Message(format!("Checksum not found for v{}", version)));
    }

    let content = response.text()?;

    // Format: "hash  filename" - extract just the hash
    content
        .split_whitespace()
        .next()
        .map(String::from)
        .ok_or_else(|| MowsError::Message("Invalid checksum format".to_string()))
}

/// Show version information and check for updates
pub fn show_version() -> Result<()> {
    let current_version = env!("CARGO_PKG_VERSION");
    let git_hash = env!("GIT_HASH");
    let git_date = env!("GIT_DATE");

    // Compute self-hash for verification
    let self_hash = get_self_hash().unwrap_or_else(|_| "unknown".to_string());
    let short_hash = &self_hash[..12.min(self_hash.len())];

    println!("mows {} ({} {}) [{}]", current_version, git_hash, git_date, short_hash);
    println!();

    // Verify binary integrity against expected checksum
    match fetch_expected_checksum(current_version) {
        Ok(expected_hash) => {
            if self_hash == expected_hash {
                println!("Binary integrity: {}", "verified".green());
            } else {
                eprintln!("{}", "WARNING: Binary hash mismatch!".red().bold());
                eprintln!("This binary may have been tampered with or built outside the standard process.");
            }
            println!("Expected Hash:      {}", expected_hash);
            println!("Local Binary Hash:  {}", self_hash);
        }
        Err(_) => {
            // Checksum not available (dev build, pre-release, or network issue)
            println!(
                "Binary integrity: {}",
                "not verified (no release checksum available)".yellow()
            );
            println!("Local Binary Hash:  {}", self_hash);
        }
    }
    println!(
        "{}",
        "(This check is for debugging only - a binary cannot securely verify itself)".dimmed()
    );

    println!();

    // Check for latest version
    print!("Checking for updates... ");
    match fetch_latest_version() {
        Ok(latest_version) => {
            if latest_version == current_version {
                println!("{}", "up to date".green().bold());
            } else if is_newer_version(&latest_version, current_version) {
                println!("{}", format!("v{} available", latest_version).yellow());
                println!("\nRun 'mows self-update' to update.");
            } else {
                // Current version is newer (dev build or downgrade scenario)
                println!(
                    "{} (latest release: v{})",
                    "up to date".green().bold(),
                    latest_version
                );
            }
        }
        Err(e) => {
            println!("{}", "failed".red());
            eprintln!("  Could not check for updates: {}", e);
        }
    }

    Ok(())
}

/// Main self-update entry point
pub fn self_update(build: bool, version: Option<&str>) -> Result<()> {
    let result = if build {
        update_from_source(version)
    } else {
        update_from_binary(version)
    };

    // Clear update notification on successful update
    if result.is_ok() {
        let _ = crate::package_manager::compose::config::MowsConfig::with_locked(|config| {
            config.clear_update_notification();
            Ok(())
        });
    }

    result
}

/// Check for updates synchronously with a short timeout (called after command completes)
/// This runs after the main command output so users see results immediately,
/// then we check for updates with a 1-second timeout to avoid delaying exit noticeably.
pub fn check_for_updates_background() {
    use crate::package_manager::compose::config::MowsConfig;

    // Load config first to check if we should skip
    let config = match MowsConfig::load() {
        Ok(c) => c,
        Err(_) => return,
    };

    if !config.should_check_for_updates() {
        return;
    }

    // Run synchronously with short timeout - this ensures the check completes
    // before process exit (unlike a detached thread which gets killed)
    check_and_save_update_info();
}

/// Check for updates and save to config
fn check_and_save_update_info() {
    use crate::package_manager::compose::config::MowsConfig;

    let current_version = env!("CARGO_PKG_VERSION");

    // Fetch latest version with short timeout
    let latest_version = match fetch_latest_version_fast() {
        Ok(v) => v,
        Err(_) => return, // Silently fail if network is slow/unavailable
    };

    // Atomically load, update, and save config
    let _ = MowsConfig::with_locked(|config| {
        // Only notify if there's actually a newer version
        if latest_version != current_version && is_newer_version(&latest_version, current_version) {
            config.set_update_available(latest_version.clone());
        } else {
            // Still update the checked_at timestamp by setting current version
            // This prevents re-checking when already up to date
            config.set_update_available(current_version.to_string());
        }
        Ok(())
    });
}

/// Parse a semver string like "1.2.3" into (major, minor, patch).
fn parse_semver(v: &str) -> Option<(u32, u32, u32)> {
    let mut parts = v.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    // Reject if there are extra components
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

/// Check whether a string is a valid semver version.
fn is_valid_semver(v: &str) -> bool {
    parse_semver(v).is_some()
}

/// Compare semantic versions to check if `new` is newer than `current`
fn is_newer_version(new: &str, current: &str) -> bool {
    match (parse_semver(new), parse_semver(current)) {
        (Some(new_ver), Some(cur_ver)) => new_ver > cur_ver,
        _ => false,
    }
}

/// Check config and print update notification if available
pub fn notify_if_update_available() {
    use crate::package_manager::compose::config::MowsConfig;

    let config = match MowsConfig::load() {
        Ok(c) => c,
        Err(_) => return,
    };

    if let Some(update) = &config.update {
        let current_version = env!("CARGO_PKG_VERSION");
        if update.available_version != current_version
            && is_newer_version(&update.available_version, current_version)
        {
            eprintln!(
                "{}",
                format!(
                    "A new version of mows is available: {} (current: {})",
                    update.available_version, current_version
                )
                .yellow()
            );
            eprintln!("{}\n", "Run 'mows self-update' to update.".yellow());
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
            "x86_64" => assert_eq!(result.unwrap(), "amd64"),
            "aarch64" => assert_eq!(result.unwrap(), "arm64"),
            _ => assert!(result.is_err()),
        }
    }

    #[test]
    fn test_get_os_returns_valid() {
        // Should return Ok on supported OS
        let result = get_os();
        match std::env::consts::OS {
            "linux" => assert_eq!(result.unwrap(), "linux"),
            "macos" => assert_eq!(result.unwrap(), "darwin"),
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

    // ========================================================================
    // move_file tests
    // ========================================================================

    #[test]
    fn test_move_file_same_filesystem() {
        use std::io::Write;

        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let src = dir.path().join("source.bin");
        let dst = dir.path().join("dest.bin");

        let mut f = File::create(&src).expect("Failed to create source");
        f.write_all(b"test content").expect("Failed to write");
        drop(f);

        move_file(&src, &dst).expect("move_file should succeed");

        assert!(!src.exists(), "Source should not exist after move");
        assert!(dst.exists(), "Destination should exist after move");
        assert_eq!(
            fs::read_to_string(&dst).expect("Failed to read dest"),
            "test content"
        );
    }

    #[test]
    fn test_move_file_source_not_found() {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let src = dir.path().join("nonexistent");
        let dst = dir.path().join("dest");

        let result = move_file(&src, &dst);
        assert!(result.is_err(), "Should fail when source doesn't exist");
    }

    // ========================================================================
    // create_mpm_symlink_if_possible tests
    // ========================================================================

    #[test]
    fn test_create_mpm_symlink_if_possible_creates_symlink() {
        use std::io::Write;

        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let mows_binary = dir.path().join("mows");
        let mut f = File::create(&mows_binary).expect("Failed to create fake binary");
        f.write_all(b"fake binary").expect("Failed to write");
        drop(f);

        create_mpm_symlink_if_possible(&mows_binary).expect("create_mpm_symlink_if_possible should succeed");

        let mpm_path = dir.path().join("mpm");
        assert!(mpm_path.symlink_metadata().is_ok(), "mpm symlink should exist");
        assert!(
            mpm_path.symlink_metadata().unwrap().file_type().is_symlink(),
            "mpm should be a symlink"
        );

        let target = fs::read_link(&mpm_path).expect("Failed to read symlink");
        assert_eq!(target, Path::new("mows"), "Symlink should point to 'mows'");
    }

    #[test]
    fn test_create_mpm_symlink_if_possible_replaces_stale_symlink() {
        use std::io::Write;

        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let mows_binary = dir.path().join("mows");
        let mut f = File::create(&mows_binary).expect("Failed to create fake binary");
        f.write_all(b"fake binary").expect("Failed to write");
        drop(f);

        // Create a stale symlink pointing to old_binary
        let mpm_path = dir.path().join("mpm");
        std::os::unix::fs::symlink("old_binary", &mpm_path)
            .expect("Failed to create stale symlink");

        create_mpm_symlink_if_possible(&mows_binary).expect("create_mpm_symlink_if_possible should succeed");

        let target = fs::read_link(&mpm_path).expect("Failed to read symlink");
        assert_eq!(target, Path::new("mows"), "Symlink should be updated to 'mows'");
    }

    #[test]
    fn test_create_mpm_symlink_if_possible_skips_real_file() {
        use std::io::Write;

        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let mows_binary = dir.path().join("mows");
        let mut f = File::create(&mows_binary).expect("Failed to create fake binary");
        f.write_all(b"fake binary").expect("Failed to write");
        drop(f);

        // Create a real file at mpm path
        let mpm_path = dir.path().join("mpm");
        let mut f = File::create(&mpm_path).expect("Failed to create mpm file");
        f.write_all(b"real binary").expect("Failed to write");
        drop(f);

        // Should succeed (skip gracefully) but NOT replace the real file
        create_mpm_symlink_if_possible(&mows_binary).expect("Should succeed even with existing real file");

        // Verify the real file is unchanged
        assert!(
            !mpm_path.symlink_metadata().unwrap().file_type().is_symlink(),
            "mpm should still be a real file, not a symlink"
        );
        assert_eq!(
            fs::read_to_string(&mpm_path).expect("Failed to read"),
            "real binary"
        );
    }

    // ========================================================================
    // parse_semver / is_valid_semver tests
    // ========================================================================

    #[test]
    fn test_parse_semver_valid() {
        assert_eq!(parse_semver("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_semver("0.0.0"), Some((0, 0, 0)));
        assert_eq!(parse_semver("100.200.300"), Some((100, 200, 300)));
    }

    #[test]
    fn test_parse_semver_invalid() {
        assert_eq!(parse_semver(""), None);
        assert_eq!(parse_semver("1"), None);
        assert_eq!(parse_semver("1.2"), None);
        assert_eq!(parse_semver("1.2.3.4"), None);
        assert_eq!(parse_semver("a.b.c"), None);
        assert_eq!(parse_semver("1.2.3-rc1"), None); // Pre-release not supported
        assert_eq!(parse_semver("-1.0.0"), None);
    }

    #[test]
    fn test_is_valid_semver() {
        assert!(is_valid_semver("0.1.0"));
        assert!(is_valid_semver("1.0.0"));
        assert!(!is_valid_semver("foo"));
        assert!(!is_valid_semver("1.0"));
        assert!(!is_valid_semver(""));
    }
}
