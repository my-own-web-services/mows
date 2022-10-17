use std::fs::read_to_string;

use anyhow::bail;
use lazy_static::lazy_static;

use crate::types::ServerConfig;

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
