use std::fs;
use std::io;
use std::path::PathBuf;

use clap::CommandFactory;
use clap_complete::aot::{generate, Shell};

use crate::cli::Cli;
use crate::error::{IoResultExt, Result};

/// Standard completion directories for each shell
fn get_completion_path(shell: Shell) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;

    match shell {
        Shell::Bash => {
            // ~/.local/share/bash-completion/completions/mpm
            Some(PathBuf::from(home).join(".local/share/bash-completion/completions/mpm"))
        }
        Shell::Zsh => {
            // ~/.zsh/completions/_mpm (user needs to add to fpath)
            // Or ~/.oh-my-zsh/completions/_mpm if oh-my-zsh is installed
            let omz_dir = PathBuf::from(&home).join(".oh-my-zsh/completions");
            if omz_dir.exists() {
                Some(omz_dir.join("_mpm"))
            } else {
                Some(PathBuf::from(home).join(".zsh/completions/_mpm"))
            }
        }
        Shell::Fish => {
            // ~/.config/fish/completions/mpm.fish
            Some(PathBuf::from(home).join(".config/fish/completions/mpm.fish"))
        }
        _ => None,
    }
}

/// Detect the current shell from environment
fn detect_shell() -> Option<Shell> {
    if let Ok(shell_path) = std::env::var("SHELL") {
        let shell_name = shell_path.rsplit('/').next().unwrap_or("");
        return match shell_name {
            "bash" => Some(Shell::Bash),
            "zsh" => Some(Shell::Zsh),
            "fish" => Some(Shell::Fish),
            _ => None,
        };
    }
    None
}

/// Generate completions for a shell
fn generate_completions(shell: Shell) -> Vec<u8> {
    let mut cmd = Cli::command();
    let mut buf = Vec::new();
    generate(shell, &mut cmd, "mpm", &mut buf);
    buf
}

/// Output shell completions to stdout
pub fn shell_init(install: bool) -> Result<()> {
    let shell = detect_shell().unwrap_or(Shell::Bash);

    if install {
        install_completions(shell)
    } else {
        // Output to stdout for piping
        let completions = generate_completions(shell);
        io::Write::write_all(&mut io::stdout(), &completions)
            .io_context("Failed to write completions")?;
        Ok(())
    }
}

/// Install completions to the standard directory for the detected shell
fn install_completions(shell: Shell) -> Result<()> {
    let path = get_completion_path(shell)
        .ok_or_else(|| format!("Unsupported shell for automatic installation: {}", shell))?;

    // Create parent directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .io_context(format!("Failed to create directory {}", parent.display()))?;
    }

    // Generate and write completions
    let completions = generate_completions(shell);
    fs::write(&path, completions)
        .io_context(format!("Failed to write completions to {}", path.display()))?;

    eprintln!("Installed {} completions to {}", shell, path.display());

    // Print additional instructions for zsh if not using oh-my-zsh
    if shell == Shell::Zsh && !path.to_string_lossy().contains("oh-my-zsh") {
        eprintln!();
        eprintln!("Add this to your ~/.zshrc if not already present:");
        eprintln!("  fpath=(~/.zsh/completions $fpath)");
        eprintln!("  autoload -Uz compinit && compinit");
    }

    Ok(())
}
