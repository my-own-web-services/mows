use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

use clap::CommandFactory;
use clap_mangen::Man;

use crate::cli::Cli;
use crate::error::{IoResultExt, MpmError, Result};

/// Get man page installation path
/// - If /usr/local/share/man is writable: use system path (in default MANPATH)
/// - Otherwise: ~/.local/share/man/man1/mpm.1
fn get_manpage_path() -> Option<PathBuf> {
    let system_man_dir = PathBuf::from("/usr/local/share/man/man1");

    // Try system directory first - it's in the default MANPATH
    // Check if we can write there (either exists and writable, or parent is writable)
    let can_use_system = if system_man_dir.exists() {
        // Directory exists - check if writable
        fs::metadata(&system_man_dir)
            .map(|m| !m.permissions().readonly())
            .unwrap_or(false)
    } else {
        // Directory doesn't exist - check if parent is writable so we can create it
        system_man_dir
            .parent()
            .and_then(|p| fs::metadata(p).ok())
            .map(|m| !m.permissions().readonly())
            .unwrap_or(false)
    };

    if can_use_system {
        Some(system_man_dir.join("mpm.1"))
    } else {
        // Fall back to user directory
        let home = std::env::var("HOME").ok()?;
        Some(PathBuf::from(home).join(".local/share/man/man1/mpm.1"))
    }
}

/// Generate man page for the main command
fn generate_main_manpage() -> Result<Vec<u8>> {
    let cmd = Cli::command();
    let mut buf = Vec::new();
    Man::new(cmd)
        .render(&mut buf)
        .io_context("Failed to generate man page")?;
    Ok(buf)
}

/// Output man page to stdout or install it
pub fn manpage(install: bool) -> Result<()> {
    let content = generate_main_manpage()?;

    if install {
        install_manpage(&content)
    } else {
        // Output to stdout for piping
        io::stdout()
            .write_all(&content)
            .io_context("Failed to write man page")?;
        Ok(())
    }
}

/// Install man page to the standard directory
fn install_manpage(content: &[u8]) -> Result<()> {
    let path = get_manpage_path()
        .ok_or_else(|| MpmError::Message("Could not determine installation path".to_string()))?;
    let man_dir = path
        .parent()
        .ok_or_else(|| MpmError::Message("Invalid man page path".to_string()))?;

    // Create directory if needed
    fs::create_dir_all(man_dir)
        .io_context(format!("Failed to create directory {}", man_dir.display()))?;

    // Write man page
    fs::write(&path, content)
        .io_context(format!("Failed to write {}", path.display()))?;

    eprintln!("Installed man page to {}", path.display());

    // Only show MANPATH instructions for user installations
    // System paths (/usr/local/share/man) are already in default MANPATH
    let is_system_path = path.starts_with("/usr");
    if !is_system_path {
        eprintln!();
        eprintln!("You may need to add to MANPATH in your shell config:");
        eprintln!("  export MANPATH=\"$HOME/.local/share/man:$MANPATH\"");
    }

    Ok(())
}
