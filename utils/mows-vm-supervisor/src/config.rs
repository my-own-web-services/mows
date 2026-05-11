use std::net::SocketAddr;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};

/// Single source of truth for runtime configuration.
///
/// Loaded from a single YAML file (path passed via `--config` or
/// `MOWS_VM_SUPERVISOR_CONFIG`), with select fields overridable by
/// individual environment variables. All env variables consulted by this
/// crate MUST be declared here — reading env elsewhere is forbidden.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SupervisorConfig {
    /// Where the sqlite database lives.
    #[serde(default = "default_state_dir")]
    pub state_dir: PathBuf,

    /// Where built/cached qcow2 images live.
    #[serde(default = "default_image_dir")]
    pub image_dir: PathBuf,

    /// Path to the unix socket exposed for local CLI use.
    #[serde(default = "default_unix_socket")]
    pub unix_socket: PathBuf,

    /// Loopback HTTP listen address (token-auth required).
    #[serde(default = "default_http_listen")]
    pub http_listen: SocketAddr,

    /// Optional HTTPS listen address — usually bound on the WireGuard
    /// interface once that ships.
    #[serde(default)]
    pub https_listen: Option<SocketAddr>,

    /// Default per-agent VM resources.
    #[serde(default)]
    pub vm_defaults: VmDefaults,

    /// QEMU binary name (override for cross-arch builds or testing).
    #[serde(default = "default_qemu_binary")]
    pub qemu_binary: String,

    /// Loopback port range (inclusive) used for ssh/docker port forwards.
    #[serde(default = "default_port_range")]
    pub port_range: PortRange,

    /// Token used by the CLI when talking over the loopback HTTP listener.
    /// Read from env `MOWS_VM_SUPERVISOR_API_TOKEN_FILE` if set,
    /// else `MOWS_VM_SUPERVISOR_API_TOKEN`. Required for the HTTP listener.
    #[serde(skip)]
    pub api_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VmDefaults {
    pub cpus: u32,
    pub memory_mb: u32,
}

impl Default for VmDefaults {
    fn default() -> Self {
        Self {
            cpus: 2,
            memory_mb: 2048,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PortRange {
    pub start: u16,
    pub end: u16,
}

fn default_state_dir() -> PathBuf {
    PathBuf::from("/var/lib/mows-agent")
}
fn default_image_dir() -> PathBuf {
    PathBuf::from("/var/lib/mows-agent/images")
}
fn default_unix_socket() -> PathBuf {
    PathBuf::from("/run/mows-agent.sock")
}
fn default_http_listen() -> SocketAddr {
    "127.0.0.1:7878".parse().expect("static parse")
}
fn default_qemu_binary() -> String {
    "qemu-system-x86_64".to_string()
}
fn default_port_range() -> PortRange {
    PortRange {
        start: 22000,
        end: 22999,
    }
}

impl SupervisorConfig {
    /// Load config from `path`, then layer in env-driven overrides.
    pub fn load(path: &std::path::Path) -> Result<Self> {
        let raw = std::fs::read_to_string(path).map_err(|e| {
            SupervisorError::Config(format!(
                "failed to read config at {}: {e}",
                path.display()
            ))
        })?;
        let mut cfg: Self = serde_yaml_neo::from_str(&raw)?;
        cfg.api_token = read_secret(
            "MOWS_VM_SUPERVISOR_API_TOKEN",
            "MOWS_VM_SUPERVISOR_API_TOKEN_FILE",
        )?;
        Ok(cfg)
    }

    /// In-memory default for unit tests and `--default-config` dumps.
    pub fn defaults_for_tests() -> Self {
        Self {
            state_dir: PathBuf::from("/tmp/mows-agent-test"),
            image_dir: PathBuf::from("/tmp/mows-agent-test/images"),
            unix_socket: PathBuf::from("/tmp/mows-agent-test.sock"),
            http_listen: default_http_listen(),
            https_listen: None,
            vm_defaults: VmDefaults::default(),
            qemu_binary: default_qemu_binary(),
            port_range: default_port_range(),
            api_token: None,
        }
    }
}

/// Read a secret from `env_var` directly, or `env_var_file` (a file path)
/// using the `_FILE` convention. Returns `Ok(None)` if neither is set.
fn read_secret(env_var: &str, env_var_file: &str) -> Result<Option<String>> {
    if let Ok(path) = std::env::var(env_var_file) {
        let contents = std::fs::read_to_string(&path).map_err(|e| {
            SupervisorError::Config(format!("failed to read {env_var_file}={path}: {e}"))
        })?;
        return Ok(Some(contents.trim().to_string()));
    }
    if let Ok(value) = std::env::var(env_var) {
        return Ok(Some(value));
    }
    Ok(None)
}
