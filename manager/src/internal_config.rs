use anyhow::bail;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::{
    fs::read_to_string,
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
};
use url::Url;

const CONFIG_PATH: &str = "/internal-config.yml";
const DEV_CONFIG_PATH: &str = "dev/config.yml";

lazy_static! {
    pub static ref INTERNAL_CONFIG: InternalConfig = read_internal_config().unwrap();
}

pub fn read_internal_config() -> anyhow::Result<InternalConfig> {
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
    let config: InternalConfig = serde_yaml::from_str(&config_file)?;

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
pub struct ConfigVariablePrefix {
    pub variable_prefix: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct InternalConfig {
    pub own_addresses: Addresses,
    pub dhcp: DhcpConfig,
    pub dev: DevConfig,
    pub log: LogConfig,
    pub cluster: LocalClusterConfig,
    pub primary_origin: Url,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct LocalClusterConfig {
    pub network: LocalClusterNetworkConfig,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct LocalClusterNetworkConfig {
    pub start: Ipv4Addr,
    pub end: Ipv4Addr,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct LogConfig {
    pub dnsmasq: LogMode,
    pub pixiecore: LogMode,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct LogMode {
    pub stdout: bool,
    pub stderr: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct DevConfig {
    pub enabled: bool,
    pub allow_origins: Vec<Url>,
    pub skip_network_policy_install: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct IpAndPort {
    pub ip: IpAddr,
    pub port: u16,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Addresses {
    pub legacy: Ipv4Addr,
    pub ip: Option<Ipv6Addr>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct DhcpConfig {
    pub dhcp_range_start: Ipv4Addr,
    pub dhcp_range_end: Ipv4Addr,
    pub lease_time: String,
}
