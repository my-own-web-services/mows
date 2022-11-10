use std::{collections::HashMap, fs::read_to_string};

use anyhow::bail;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

const CONFIG_PATH: &str = "/config.yml";
const DEV_CONFIG_PATH: &str = "dev/config.yml";

lazy_static! {
    pub static ref SERVER_CONFIG: ServerConfig = read_config().unwrap();
}

pub fn read_config() -> anyhow::Result<ServerConfig> {
    let config_file = match read_to_string(CONFIG_PATH) {
        Ok(file) => file,
        Err(_) => match {
            println!("Config file not found trying dev path");
            read_to_string(DEV_CONFIG_PATH)
        } {
            Ok(file) => file,
            Err(_) => bail!("Config file not found"),
        },
    };

    let config_file = replace_variables(config_file)?;
    let config: ServerConfig = serde_yaml::from_str(&config_file)?;
    Ok(config)
}

pub fn replace_variables(mut config_file: String) -> anyhow::Result<String> {
    let first_config: ServerConfig = serde_yaml::from_str(&config_file)?;
    for (key, value) in std::env::vars() {
        config_file = config_file.replace(
            format!("{}{}", first_config.variable_prefix, key).as_str(),
            &value,
        );
    }

    Ok(config_file)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub variable_prefix: String,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub storage: HashMap<String, StorageConfig>,
    pub default_storage: String,
    pub db: DbConfig,
    pub interossea: InterosseaConfig,
    pub http: HttpConfig,
    pub dev: DevConfig,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevConfig {
    pub insecure_skip_interossea: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InterosseaConfig {
    pub url: String,
    pub assertion_validity_seconds: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HttpConfig {
    pub internal_address: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbConfig {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    pub path: String,
    /**
    A storage location: either to seperate files onto different drives or because of speed or type
    */
    pub limit: Option<u64>,
}
