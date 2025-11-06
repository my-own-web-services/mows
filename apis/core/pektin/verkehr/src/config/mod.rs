use anyhow::bail;
use serde::Deserialize;
use std::{fs::File, io::Read};

#[derive(Deserialize, Debug, Clone)]
pub struct VerkehrConfig {
    pub providers: RoutingConfigProviders,
    pub log: LogConfig,
    pub api: ApiConfig,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ApiConfig {
    pub enabled: bool,
    pub dashboard: bool,
    pub readonly: bool,
}

#[derive(Deserialize, Debug, Clone)]
pub struct LogConfig {
    pub level: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct RoutingConfigProviders {
    pub docker: Option<DockerLabelsProvider>,
    pub file: Option<FileProvider>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct FileProvider {
    pub directory: Option<String>,
    pub file: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerLabelsProvider {
    pub enabled: Option<bool>,
    pub exposed_by_default: Option<bool>,
}

pub fn load_verkehr_config(path: &str) -> anyhow::Result<VerkehrConfig> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    let file_type = if path.ends_with("yaml") || path.ends_with("yml") {
        "yaml"
    } else if path.ends_with("json") {
        "json"
    } else {
        bail!("could not determine file type because the file ending is missing")
    };

    let config: VerkehrConfig = match file_type {
        "yaml" => serde_yaml::from_str(&contents)?,
        "json" => serde_json::from_str(&contents)?,
        _ => bail!("file type not supported"),
    };

    Ok(config)
}
