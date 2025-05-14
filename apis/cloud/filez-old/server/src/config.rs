use anyhow::bail;
use filez_common::storage::types::StorageConfig;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::read_to_string;

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

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub storage: StorageConfig,
    pub db: DbConfig,
    pub interossea: InterosseaConfig,
    pub http: HttpConfig,
    pub dev: DevConfig,
    pub service_id: String,
    pub services: Vec<Service>,
    pub constraints: Constraints,
    pub users: UsersConfig,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub allowed_origins: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Constraints {
    pub max_file_size: u64,
    pub other_max_body_size: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevConfig {
    pub insecure_skip_interossea: bool,
    pub disable_complex_access_control: bool,
    pub create_mock_users: bool,
    pub mock_user_path: String,
    pub check_database_consistency_on_startup: bool,
    pub check_database_consistency_on_mutating_requests: bool,
    pub check_database_consistency_remove_orphaned_files: bool,
    pub create_mock_file_entries_until_reached_limit: Option<u32>,
    pub mock_files_owner_email: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsersConfig {
    pub make_admin: Vec<String>,
    pub create: Vec<String>,
    pub allow_new: bool,
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
    pub parallel_queries: u32,
}
