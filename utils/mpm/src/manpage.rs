use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

use clap::{Command, CommandFactory};
use clap_mangen::Man;

use crate::cli::{build_mpm_command, Cli};
use crate::error::{IoResultExt, MowsError, Result};

/// Get man page installation directory
/// - If /usr/local/share/man/man1 is writable: use system path (in default MANPATH)
/// - Otherwise: ~/.local/share/man/man1
fn get_manpage_dir() -> Option<PathBuf> {
    let system_man_dir = PathBuf::from("/usr/local/share/man/man1");

    // Try system directory first - it's in the default MANPATH
    let can_use_system = if system_man_dir.exists() {
        fs::metadata(&system_man_dir)
            .map(|m| !m.permissions().readonly())
            .unwrap_or(false)
    } else {
        system_man_dir
            .parent()
            .and_then(|p| fs::metadata(p).ok())
            .map(|m| !m.permissions().readonly())
            .unwrap_or(false)
    };

    if can_use_system {
        Some(system_man_dir)
    } else {
        let home = std::env::var("HOME").ok()?;
        Some(PathBuf::from(home).join(".local/share/man/man1"))
    }
}

/// Generate man page for a command
fn generate_manpage(cmd: &Command) -> Result<Vec<u8>> {
    let mut buf = Vec::new();
    Man::new(cmd.clone())
        .render(&mut buf)
        .io_context("Failed to generate man page")?;
    Ok(buf)
}

/// Recursively collect all commands (main + subcommands)
fn collect_commands(cmd: &Command, prefix: &str) -> Vec<(String, Command)> {
    let mut commands = Vec::new();
    let name = if prefix.is_empty() {
        cmd.get_name().to_string()
    } else {
        format!("{}-{}", prefix, cmd.get_name())
    };

    commands.push((name.clone(), cmd.clone()));

    for sub in cmd.get_subcommands() {
        // Skip help subcommand
        if sub.get_name() == "help" {
            continue;
        }
        commands.extend(collect_commands(sub, &name));
    }

    commands
}

/// Output man page to stdout or install all man pages
pub fn manpage(install: bool) -> Result<()> {
    let cmd = Cli::command();

    if install {
        install_all_manpages(&cmd)?;

        // Also install mpm man pages
        let mpm_cmd = build_mpm_command()?;
        install_all_manpages(&mpm_cmd)?;

        Ok(())
    } else {
        // Output main man page to stdout for piping
        let content = generate_manpage(&cmd)?;
        io::stdout()
            .write_all(&content)
            .io_context("Failed to write man page")?;
        Ok(())
    }
}

/// Install man pages for all commands to the standard directory
fn install_all_manpages(cmd: &Command) -> Result<()> {
    let man_dir = get_manpage_dir()
        .ok_or_else(|| MowsError::Message("Could not determine installation path".to_string()))?;

    // Create directory if needed
    fs::create_dir_all(&man_dir)
        .io_context(format!("Failed to create directory {}", man_dir.display()))?;

    // Collect all commands
    let commands = collect_commands(cmd, "");

    // Generate and write man pages
    let mut count = 0;
    for (name, subcmd) in &commands {
        let content = generate_manpage(subcmd)?;
        let path = man_dir.join(format!("{}.1", name));
        fs::write(&path, content)
            .io_context(format!("Failed to write {}", path.display()))?;
        count += 1;
    }

    eprintln!("Installed {} man pages for {} to {}", count, cmd.get_name(), man_dir.display());

    // Only show MANPATH instructions for user installations
    let is_system_path = man_dir.starts_with("/usr");
    if !is_system_path {
        eprintln!();
        eprintln!("You may need to add to MANPATH in your shell config:");
        eprintln!("  export MANPATH=\"$HOME/.local/share/man:$MANPATH\"");
    }

    Ok(())
}
