use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

use clap::CommandFactory;
use clap_mangen::Man;

use crate::cli::Cli;

/// Standard man page directory for user installations
fn get_manpage_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    // ~/.local/share/man/man1/mpm.1
    Some(PathBuf::from(home).join(".local/share/man/man1/mpm.1"))
}

/// Generate man page for the main command
fn generate_main_manpage() -> Result<Vec<u8>, String> {
    let cmd = Cli::command();
    let mut buf = Vec::new();
    Man::new(cmd)
        .render(&mut buf)
        .map_err(|e| format!("Failed to generate man page: {}", e))?;
    Ok(buf)
}

/// Output man page to stdout or install it
pub fn manpage(install: bool) -> Result<(), String> {
    let content = generate_main_manpage()?;

    if install {
        install_manpage(&content)
    } else {
        // Output to stdout for piping
        io::stdout()
            .write_all(&content)
            .map_err(|e| format!("Failed to write man page: {}", e))?;
        Ok(())
    }
}

/// Install man page to the standard directory
fn install_manpage(content: &[u8]) -> Result<(), String> {
    let path = get_manpage_path()
        .ok_or_else(|| "Could not determine HOME directory".to_string())?;
    let man_dir = path
        .parent()
        .ok_or_else(|| "Invalid man page path".to_string())?;

    // Create directory if needed
    fs::create_dir_all(man_dir)
        .map_err(|e| format!("Failed to create directory {}: {}", man_dir.display(), e))?;

    // Write man page
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    eprintln!("Installed man page to {}", path.display());
    eprintln!();
    eprintln!("You may need to update the man database:");
    eprintln!("  mandb ~/.local/share/man");
    eprintln!();
    eprintln!("Or add to MANPATH in your shell config:");
    eprintln!("  export MANPATH=\"$HOME/.local/share/man:$MANPATH\"");

    Ok(())
}
