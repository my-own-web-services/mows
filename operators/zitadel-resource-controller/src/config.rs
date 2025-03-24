use std::sync::OnceLock;

use mows_common::config::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ControllerConfig> {
    static CONFIG: OnceLock<RwLock<ControllerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ControllerConfig {
    pub vault_url: String,
    pub service_account_token_path: String,
    /// the endpoint to reach the zitadel api at
    pub zitadel_api_endpoint: String,
    /// the domain name that the zitadel tls certificate is valid for
    pub zitadel_tls_domain_name: String,
    /// The address that zitadel uses
    pub zitadel_external_origin: String,
    pub zitadel_pa_token: String,
    pub reconcile_interval_seconds: u64,
    pub ca_certificate_pem: String,
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    Ok(ControllerConfig {
        vault_url: load_env(
            "http://vault.mows-core-secrets-vault:8200",
            "VAULT_URL",
            false,
            true,
        )?,
        service_account_token_path: load_env(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "SERVICE_ACCOUNT_TOKEN_PATH",
            false,
            true,
        )?,
        zitadel_api_endpoint: load_env(
            "http://zitadel.mows-core-auth-zitadel:8080",
            "ZITADEL_API_ENDPOINT",
            false,
            true,
        )?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false, true)?.parse()?,
        zitadel_pa_token: load_env("", "ZITADEL_PA_TOKEN", true, true)?,
        ca_certificate_pem: load_env("", "CA_CERTIFICATE_PEM", false, true)?,
        zitadel_tls_domain_name: load_env("zitadel", "ZITADEL_TLS_DOMAIN_NAME", false, true)?,
        zitadel_external_origin: load_env(
            "https://zitadel.vindelicorum.eu",
            "ZITADEL_EXTERNAL_ORIGIN",
            false,
            true,
        )?,
    })
}

/*
kubectl port-forward -n mows-core-auth-zitadel service/zitadel --address 0.0.0.0 8080:http2-server

*/
