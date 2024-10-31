use std::{fs::read_to_string, sync::OnceLock};

use anyhow::bail;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

const CONFIG_PATH: &str = "/config.yaml";
const DEV_CONFIG_PATH: &str = "dev/config.yaml";

pub fn config() -> &'static RwLock<ApiConfig> {
    static API_CONFIG: OnceLock<RwLock<ApiConfig>> = OnceLock::new();
    API_CONFIG.get_or_init(|| RwLock::new(read_config().unwrap()))
}

pub fn read_config() -> anyhow::Result<ApiConfig> {
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
    let config: ApiConfig = serde_yaml::from_str(&config_file)?;
    Ok(config)
}

pub fn replace_variables(mut config_file: String) -> anyhow::Result<String> {
    let first_config: ConfigVariablePrefix = serde_yaml::from_str(&config_file)?;
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
pub struct ConfigVariablePrefix {
    pub variable_prefix: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub bind_address: String,
    pub bind_port: u16,
    pub db_hostname: String,
    pub db_username: String,
    pub db_password: String,
    pub db_port: u16,
    pub vault_uri: String,
    pub ribston_uri: String,
    pub skip_auth: String,
    pub use_policies: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
    pub policy_vault_path: String,
}
