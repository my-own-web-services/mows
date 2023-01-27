use anyhow::bail;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::read_to_string;

const CONFIG_PATH: &str = "/config.yml";
const DEV_CONFIG_PATH: &str = "dev/config.yml";

lazy_static! {
    pub static ref CONFIG: Config = read_config().unwrap();
}

pub fn read_config() -> anyhow::Result<Config> {
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
    let config: Config = serde_yaml::from_str(&config_file)?;
    Ok(config)
}

pub fn replace_variables(mut config_file: String) -> anyhow::Result<String> {
    let first_config: Config = serde_yaml::from_str(&config_file)?;
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
pub struct Config {
    pub variable_prefix: String,
    pub storage_path: String,
    pub timeout_seconds: u64,
    pub db: DbConfig,
    pub image: ImageConfig,
    pub dev: DevConfig,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevConfig {
    pub clear_own_app_data_on_start: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbConfig {
    pub url: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageConfig {
    pub quality: u8,
    pub target_resolutions: Vec<u32>,
}
