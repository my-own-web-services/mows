use pektin_common::load_env;

use crate::errors_and_responses::PektinApiResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub bind_address: String,
    pub bind_port: u16,
    pub db_hostname: String,
    pub db_username: String,
    pub db_password: String,
    pub db_port: u16,
    pub vault_uri: String,
    pub ribston_uri: String,
    pub vault_password: String,
    pub vault_user_name: String,
    pub skip_auth: String,
    pub use_policies: String,
}

impl Config {
    pub fn from_env() -> PektinApiResult<Self> {
        Ok(Self {
            bind_address: load_env("::", "BIND_ADDRESS", false)?,
            bind_port: load_env("80", "BIND_PORT", false)?
                .parse()
                .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("BIND_PORT".into()))?,
            db_hostname: load_env("pektin-db", "DB_HOSTNAME", false)?,
            db_port: load_env("6379", "DB_PORT", false)?
                .parse()
                .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("DB_PORT".into()))?,
            db_username: load_env("db-pektin-api", "DB_USERNAME", false)?,
            db_password: load_env("", "DB_PASSWORD", true)?,
            vault_uri: load_env("http://pektin-vault:80", "VAULT_URI", false)?,
            ribston_uri: load_env("http://pektin-ribston:80", "RIBSTON_URI", false)?,
            vault_password: load_env("", "V_PEKTIN_API_PASSWORD", true)?,
            vault_user_name: load_env("", "V_PEKTIN_API_USER_NAME", false)?,
            use_policies: load_env("ribston", "USE_POLICIES", false)?,
            skip_auth: load_env("false", "SKIP_AUTH", false)?,
        })
    }
}
