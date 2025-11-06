use anyhow::bail;
use std::{fs::File, io::Read};

use crate::routing_config::RoutingConfig;

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
        "yaml" => serde_yaml::from_str(&contents)?,
        "json" => serde_json::from_str(&contents)?,
        _ => bail!("file type not supported"),
    };

    Ok(config)
}
