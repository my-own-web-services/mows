use std::{collections::HashMap, fs::read_to_string};

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub headers: Headers,
    pub variable_prefix: String,
    pub no_memory: Vec<String>,
}
#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct Headers {
    pub all: HashMap<String, String>,
    pub document: HashMap<String, String>,
}

const CONFIG_PATH: &str = "/config.yml";

pub fn read_config() -> Config {
    let config_file = read_to_string(CONFIG_PATH).unwrap();
    let config_file = replace_variables(config_file);
    let mut config: Config = serde_yaml::from_str(&config_file).unwrap();
    for header in config.headers.all.clone() {
        config.headers.all.insert(
            header.0.to_string(),
            header
                .1
                .replace('\n', " ")
                .replace('\r', " ")
                .replace("  ", " "),
        );
    }
    for header in config.headers.document.clone() {
        config.headers.document.insert(
            header.0.to_string(),
            header
                .1
                .replace('\n', " ")
                .replace('\r', " ")
                .replace("  ", " "),
        );
    }

    config
}

pub fn replace_variables(mut config_file: String) -> String {
    let first_config: Config = serde_yaml::from_str(&config_file).unwrap();
    for (key, value) in std::env::vars() {
        config_file = config_file.replace(
            format!("{}{}", first_config.variable_prefix, key).as_str(),
            &value,
        );
    }

    config_file
}
