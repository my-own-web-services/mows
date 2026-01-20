use anyhow::bail;
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

use crate::config::routing_config::RoutingConfig;
use tracing::{debug, error, info, warn};

pub fn load_file_config(path: &str) -> anyhow::Result<RoutingConfig> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    let file_type = if path.ends_with("yaml") || path.ends_with("yml") {
        "yaml"
    } else if path.ends_with("json") {
        "json"
    } else {
        bail!("Supported file types are yaml/yml and json")
    };

    let config: RoutingConfig = match file_type {
        "yaml" => serde_yaml_neo::from_str(&contents)?,
        "json" => serde_json::from_str(&contents)?,
        _ => bail!("file type not supported"),
    };

    Ok(config)
}

/// Recursively loads all config files from a directory and its subdirectories
pub fn load_directory_config(directory: &str) -> anyhow::Result<RoutingConfig> {
    let path = Path::new(directory);
    if !path.exists() {
        bail!("Directory does not exist: {}", directory);
    }
    if !path.is_dir() {
        bail!("Path is not a directory: {}", directory);
    }

    let config_files = find_config_files_recursive(path)?;

    if config_files.is_empty() {
        warn!(directory = %directory, "No config files found in directory");
        return Ok(RoutingConfig::default());
    }

    info!(
        directory = %directory,
        count = config_files.len(),
        "Found config files"
    );

    let mut combined_config = RoutingConfig::default();

    for config_file in &config_files {
        match load_file_config(config_file.to_str().unwrap_or_default()) {
            Ok(config) => {
                debug!(file = %config_file.display(), "Loaded config file");
                combined_config.merge(config);
                debug!(
                    config = ?combined_config,
                    "Config after merging file"
                );
            }
            Err(e) => {
                error!(
                    file = %config_file.display(),
                    error = %e,
                    "Failed to load config file"
                );
            }
        }
    }

    Ok(combined_config)
}

/// Recursively finds all YAML and JSON files in a directory
fn find_config_files_recursive(dir: &Path) -> anyhow::Result<Vec<PathBuf>> {
    let mut config_files = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Recursively search subdirectories
            config_files.extend(find_config_files_recursive(&path)?);
        } else if path.is_file() {
            // Check if file has a supported extension
            if let Some(extension) = path.extension() {
                let ext = extension.to_str().unwrap_or_default();
                if ext == "yaml" || ext == "yml" || ext == "json" {
                    config_files.push(path);
                }
            }
        }
    }

    Ok(config_files)
}
