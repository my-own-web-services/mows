use std::path::PathBuf;
use std::process::Command;
use tracing::debug;

use crate::error::{MpmError, Result};

pub fn find_git_root() -> Result<PathBuf> {
    debug!("Finding git repository root");
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|e| MpmError::command("git rev-parse", e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MpmError::Git(format!("Not in a git repository: {}", stderr.trim())));
    }

    let path_str = String::from_utf8_lossy(&output.stdout);
    let path = PathBuf::from(path_str.trim());

    debug!("Git root: {}", path.display());
    Ok(path)
}
