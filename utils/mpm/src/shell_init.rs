use std::fs;
use std::io;
use std::path::PathBuf;

use clap::CommandFactory;
use clap_complete::aot::{generate, Shell};

use crate::cli::{build_mpm_command, Cli};
use crate::error::{IoResultExt, Result};

/// Standard completion directories for each shell
fn get_completion_path(shell: Shell, binary_name: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;

    match shell {
        Shell::Bash => {
            Some(PathBuf::from(home).join(format!(".local/share/bash-completion/completions/{}", binary_name)))
        }
        Shell::Zsh => {
            let omz_dir = PathBuf::from(&home).join(".oh-my-zsh/completions");
            if omz_dir.exists() {
                Some(omz_dir.join(format!("_{}", binary_name)))
            } else {
                Some(PathBuf::from(home).join(format!(".zsh/completions/_{}", binary_name)))
            }
        }
        Shell::Fish => {
            Some(PathBuf::from(home).join(format!(".config/fish/completions/{}.fish", binary_name)))
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

/// Generate completions for the mows binary
fn generate_mows_completions(shell: Shell) -> Vec<u8> {
    let mut cmd = Cli::command();
    let mut buf = Vec::new();
    generate(shell, &mut cmd, "mows", &mut buf);
    buf
}

/// Generate completions for the mpm alias binary
fn generate_mpm_completions(shell: Shell) -> Result<Vec<u8>> {
    let mut cmd = build_mpm_command()?;
    let mut buf = Vec::new();
    generate(shell, &mut cmd, "mpm", &mut buf);
    Ok(buf)
}

/// Output shell completions to stdout or install them
pub fn shell_init(install: bool) -> Result<()> {
    let shell = detect_shell().unwrap_or(Shell::Bash);

    if install {
        install_completions(shell)
    } else {
        // Output mows completions to stdout for piping
        let completions = generate_mows_completions(shell);
        io::Write::write_all(&mut io::stdout(), &completions)
            .io_context("Failed to write completions")?;
        Ok(())
    }
}

/// Install completions for both mows and mpm to the standard directory
fn install_completions(shell: Shell) -> Result<()> {
    // Install mows completions
    install_completions_for(shell, "mows", generate_mows_completions(shell))?;
    // Install mpm completions
    install_completions_for(shell, "mpm", generate_mpm_completions(shell)?)?;

    // Print additional instructions for zsh if not using oh-my-zsh
    if shell == Shell::Zsh {
        let path = get_completion_path(shell, "mows");
        if let Some(p) = path {
            if !p.to_string_lossy().contains("oh-my-zsh") {
                eprintln!();
                eprintln!("Add this to your ~/.zshrc if not already present:");
                eprintln!("  fpath=(~/.zsh/completions $fpath)");
                eprintln!("  autoload -Uz compinit && compinit");
            }
        }
    }

    Ok(())
}

/// Install completions for a specific binary name
fn install_completions_for(shell: Shell, binary_name: &str, completions: Vec<u8>) -> Result<()> {
    let path = get_completion_path(shell, binary_name)
        .ok_or_else(|| format!("Unsupported shell for automatic installation: {}", shell))?;

    // Create parent directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .io_context(format!("Failed to create directory {}", parent.display()))?;
    }

    fs::write(&path, completions)
        .io_context(format!("Failed to write completions to {}", path.display()))?;

    eprintln!("Installed {} completions for {} to {}", shell, binary_name, path.display());

    Ok(())
}
