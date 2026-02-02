use std::process::Command;

fn main() {
    // Try to get git info, fallback to env vars (for Docker builds) or "unknown"
    let git_hash = get_git_hash()
        .or_else(|| std::env::var("GIT_HASH").ok())
        .unwrap_or_else(|| "unknown".to_string());

    let git_date = get_git_date()
        .or_else(|| std::env::var("GIT_DATE").ok())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=GIT_HASH={}", git_hash);
    println!("cargo:rustc-env=GIT_DATE={}", git_date);

    // Rerun if git HEAD changes (if available)
    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-changed=.git/index");
    println!("cargo:rerun-if-env-changed=GIT_HASH");
    println!("cargo:rerun-if-env-changed=GIT_DATE");
}

fn get_git_hash() -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let hash = String::from_utf8(output.stdout).ok()?.trim().to_string();

    // Check if working directory is dirty
    let is_dirty = Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .ok()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false);

    if is_dirty {
        Some(format!("{}-dirty", hash))
    } else {
        Some(hash)
    }
}

fn get_git_date() -> Option<String> {
    let output = Command::new("git")
        .args(["log", "-1", "--format=%cs"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout)
        .ok()
        .map(|s| s.trim().to_string())
}
