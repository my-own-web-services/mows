use std::sync::OnceLock;

use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ControllerConfig> {
    static CONFIG: OnceLock<RwLock<ControllerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderMode {
    Kubernetes,
    Docker,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VaultAuthMethodConfig {
    Kubernetes,
    Token,
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
    /// Which provider to use: auto-detected from environment or set via PROVIDER_MODE
    pub provider_mode: ProviderMode,
    /// Docker socket path (only used when provider_mode is Docker)
    pub docker_socket_path: String,
    /// Label prefix for Docker labels (only used when provider_mode is Docker)
    pub docker_label_prefix: String,
    /// Vault auth method: "kubernetes" or "token"
    pub vault_auth_method: VaultAuthMethodConfig,
    /// Vault token (only used when vault_auth_method is Token)
    pub vault_token: Option<String>,
}

/// Detect provider mode from an explicit mode string and filesystem paths.
///
/// Resolution order:
/// 1. If `explicit_mode` is non-empty, parse it as "kubernetes" or "docker"
/// 2. If a Kubernetes service account token exists at `service_account_token_path`, use Kubernetes
/// 3. If the Docker socket exists at `docker_socket_path`, use Docker
/// 4. Otherwise, fail with an error
fn detect_provider_mode(
    explicit_mode: &str,
    service_account_token_path: &str,
    docker_socket_path: &str,
) -> anyhow::Result<ProviderMode> {
    if !explicit_mode.is_empty() {
        return match explicit_mode {
            "kubernetes" => Ok(ProviderMode::Kubernetes),
            "docker" => Ok(ProviderMode::Docker),
            other => Err(anyhow::anyhow!(
                "Invalid PROVIDER_MODE '{}', expected 'kubernetes' or 'docker'",
                other
            )),
        };
    }

    if std::path::Path::new(service_account_token_path).exists() {
        return Ok(ProviderMode::Kubernetes);
    }

    if std::path::Path::new(docker_socket_path).exists() {
        return Ok(ProviderMode::Docker);
    }

    Err(anyhow::anyhow!(
        "Could not detect provider mode: no Kubernetes service account token at '{}' and no Docker socket at '{}'. Set PROVIDER_MODE explicitly.",
        service_account_token_path,
        docker_socket_path
    ))
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    let vault_token_raw = load_env("", "VAULT_TOKEN", false, true)?;
    let vault_token = if vault_token_raw.is_empty() {
        None
    } else {
        Some(vault_token_raw)
    };

    let service_account_token_path = load_env(
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
        "SERVICE_ACCOUNT_TOKEN_PATH",
        false,
        true,
    )?;

    let docker_socket_path = load_env(
        "/var/run/docker.sock",
        "DOCKER_SOCKET_PATH",
        false,
        true,
    )?;

    let explicit_mode = load_env("", "PROVIDER_MODE", false, true)?;
    let provider_mode = detect_provider_mode(&explicit_mode, &service_account_token_path, &docker_socket_path)?;

    Ok(ControllerConfig {
        vault_url: load_env(
            "http://vault.mows-core-secrets-vault:8200",
            "VAULT_URL",
            false,
            true,
        )?,
        service_account_token_path,
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
        provider_mode,
        docker_socket_path,
        docker_label_prefix: load_env("zrc", "DOCKER_LABEL_PREFIX", false, true)?,
        vault_auth_method: match load_env("kubernetes", "VAULT_AUTH_METHOD", false, true)?.as_str()
        {
            "token" => VaultAuthMethodConfig::Token,
            _ => VaultAuthMethodConfig::Kubernetes,
        },
        vault_token,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Auto-detection tests (empty explicit_mode) ---

    #[test]
    fn test_detect_provider_mode_kubernetes_token_exists() {
        // Use a path that definitely exists on any system
        let result = detect_provider_mode("", "/dev/null", "/nonexistent/docker.sock");
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Kubernetes));
    }

    #[test]
    fn test_detect_provider_mode_docker_socket_exists() {
        // K8s token doesn't exist, Docker socket does
        let result = detect_provider_mode(
            "",
            "/nonexistent/serviceaccount/token",
            "/dev/null",
        );
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Docker));
    }

    #[test]
    fn test_detect_provider_mode_neither_exists() {
        let result = detect_provider_mode(
            "",
            "/nonexistent/serviceaccount/token",
            "/nonexistent/docker.sock",
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Could not detect provider mode"));
        assert!(err.contains("/nonexistent/serviceaccount/token"));
        assert!(err.contains("/nonexistent/docker.sock"));
    }

    #[test]
    fn test_detect_provider_mode_kubernetes_takes_precedence() {
        // Both exist: K8s should take precedence
        let result = detect_provider_mode("", "/dev/null", "/dev/null");
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Kubernetes));
    }

    #[test]
    fn test_detect_provider_mode_with_temp_files() {
        let dir = std::env::temp_dir();
        let k8s_path = dir.join("zrc-test-k8s-token");
        let docker_path = dir.join("zrc-test-docker-sock");

        // Clean up any previous test artifacts
        let _ = std::fs::remove_file(&k8s_path);
        let _ = std::fs::remove_file(&docker_path);

        // Neither exists
        let result = detect_provider_mode(
            "",
            k8s_path.to_str().unwrap(),
            docker_path.to_str().unwrap(),
        );
        assert!(result.is_err());

        // Create only docker socket
        std::fs::write(&docker_path, "").unwrap();
        let result = detect_provider_mode(
            "",
            k8s_path.to_str().unwrap(),
            docker_path.to_str().unwrap(),
        );
        assert!(matches!(result.unwrap(), ProviderMode::Docker));

        // Create k8s token too - should prefer k8s
        std::fs::write(&k8s_path, "").unwrap();
        let result = detect_provider_mode(
            "",
            k8s_path.to_str().unwrap(),
            docker_path.to_str().unwrap(),
        );
        assert!(matches!(result.unwrap(), ProviderMode::Kubernetes));

        // Clean up
        let _ = std::fs::remove_file(&k8s_path);
        let _ = std::fs::remove_file(&docker_path);
    }

    // --- Explicit mode tests ---

    #[test]
    fn test_detect_provider_mode_explicit_kubernetes() {
        // Explicit mode should override auto-detection regardless of paths
        let result = detect_provider_mode(
            "kubernetes",
            "/nonexistent/serviceaccount/token",
            "/nonexistent/docker.sock",
        );
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Kubernetes));
    }

    #[test]
    fn test_detect_provider_mode_explicit_docker() {
        // Explicit mode should override auto-detection regardless of paths
        let result = detect_provider_mode(
            "docker",
            "/nonexistent/serviceaccount/token",
            "/nonexistent/docker.sock",
        );
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Docker));
    }

    #[test]
    fn test_detect_provider_mode_explicit_invalid() {
        let result = detect_provider_mode(
            "invalid_mode",
            "/dev/null",
            "/dev/null",
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Invalid PROVIDER_MODE"));
        assert!(err.contains("invalid_mode"));
    }

    #[test]
    fn test_detect_provider_mode_explicit_overrides_autodetect() {
        // Even though K8s token exists, explicit "docker" should win
        let result = detect_provider_mode("docker", "/dev/null", "/nonexistent/docker.sock");
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), ProviderMode::Docker));
    }
}
