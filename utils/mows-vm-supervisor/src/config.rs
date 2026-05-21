//! Runtime configuration for `mows-vm-supervisor`.
//!
//! # Environment variables (DEVOPS-50 — single block of truth)
//!
//! Every env var read by this crate is listed here. Reading env in any
//! other file is forbidden by the project's CLAUDE.md and will not pass
//! review.
//!
//! | Variable                              | Consumed by                                | Purpose                                                                 |
//! |---------------------------------------|--------------------------------------------|-------------------------------------------------------------------------|
//! | `MOWS_VM_SUPERVISOR_CONFIG`           | `main.rs` (CLI arg fallback)               | Path to the YAML config file.                                           |
//! | `MOWS_VM_SUPERVISOR_API_TOKEN`        | `SupervisorConfig::load`                   | Static admin bearer token for the TCP listener.                         |
//! | `MOWS_VM_SUPERVISOR_API_TOKEN_FILE`   | `SupervisorConfig::load`                   | `_FILE` variant — reads the token from disk.                            |
//! | `MOWS_AGENT_HOST_CREDS_PATH`          | `SupervisorConfig::load`                   | Host directory bind-mounted as `/creds` inside every guest (SECURITY-13). |
//! | `RUST_LOG`                            | `mows_common_rust::observability::init_observability` | Tracing filter — standard tracing-subscriber syntax.                    |

use std::net::SocketAddr;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};

/// Single source of truth for runtime configuration.
///
/// Loaded from a single YAML file (path passed via `--config` or
/// `MOWS_VM_SUPERVISOR_CONFIG`), with select fields overridable by
/// individual environment variables. See the module-level docstring
/// above for the complete env-var inventory.
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

    /// Externally-reachable hostname/IP advertised in API responses that
    /// describe how to connect back to a VM (e.g. `VmSshInfo.host`). For
    /// local-only deployments the default `127.0.0.1` is correct; for a
    /// supervisor reachable from another machine, set this to the public
    /// hostname or WireGuard address.
    #[serde(default = "default_external_host")]
    pub external_host: String,

    /// Guest SSH username the supervisor uses for inbound shell access
    /// (e.g. `mows-agent-init` provisioned root vs. an unprivileged
    /// `mows-agent` user). Hoisted from the previously-hardcoded
    /// `root@127.0.0.1` so call sites stop drifting.
    #[serde(default = "default_guest_ssh_user")]
    pub guest_ssh_user: String,

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

    /// Host directory bind-mounted read-only into every guest at `/creds`.
    /// Resolved once at startup from `MOWS_AGENT_HOST_CREDS_PATH` (with a
    /// fallback to `/host-creds` if that exists). Reading it from the
    /// environment is forbidden anywhere else in this crate — the rule
    /// from CLAUDE.md is "all env vars read upfront in one central file".
    #[serde(skip)]
    pub agent_host_creds_path: Option<PathBuf>,
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
fn default_external_host() -> String {
    "127.0.0.1".to_string()
}
fn default_guest_ssh_user() -> String {
    "root".to_string()
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
        let mut config: Self = serde_yaml_neo::from_str(&raw)?;
        config.api_token = read_secret(
            "MOWS_VM_SUPERVISOR_API_TOKEN",
            "MOWS_VM_SUPERVISOR_API_TOKEN_FILE",
        )?;
        config.agent_host_creds_path = resolve_agent_host_creds_path();
        Ok(config)
    }

    /// In-memory default for unit tests — uses `/tmp/...` paths so a
    /// failing test can't accidentally clobber a real state dir.
    pub fn defaults_for_tests() -> Self {
        Self {
            state_dir: PathBuf::from("/tmp/mows-agent-test"),
            image_dir: PathBuf::from("/tmp/mows-agent-test/images"),
            unix_socket: PathBuf::from("/tmp/mows-agent-test.sock"),
            http_listen: default_http_listen(),
            external_host: default_external_host(),
            guest_ssh_user: default_guest_ssh_user(),
            https_listen: None,
            vm_defaults: VmDefaults::default(),
            qemu_binary: default_qemu_binary(),
            port_range: default_port_range(),
            api_token: None,
            agent_host_creds_path: None,
        }
    }

    /// Production-safe defaults for `--print-default-config`. Differs
    /// from `defaults_for_tests` in that the on-disk paths point at
    /// `/var/lib/mows-agent` (the live-deployment convention) and the
    /// unix socket lives under `/run/`. Operators piping this into
    /// `config.yaml` get a config that works against a real deployment.
    ///
    /// SLOP-39: the old code path used `defaults_for_tests` for
    /// `--print-default-config`, which baked test paths into operator
    /// configs.
    pub fn defaults_for_user() -> Self {
        Self {
            state_dir: default_state_dir(),
            image_dir: default_image_dir(),
            unix_socket: default_unix_socket(),
            http_listen: default_http_listen(),
            external_host: default_external_host(),
            guest_ssh_user: default_guest_ssh_user(),
            https_listen: None,
            vm_defaults: VmDefaults::default(),
            qemu_binary: default_qemu_binary(),
            port_range: default_port_range(),
            api_token: None,
            agent_host_creds_path: None,
        }
    }
}

/// Resolve the host path bind-mounted as `/creds` inside every guest.
///
/// The env var `MOWS_AGENT_HOST_CREDS_PATH` wins. If unset, fall back to
/// `/host-creds` only when that directory actually exists (legacy
/// container layout). The path is consulted at startup; we deliberately
/// do NOT re-read the env in `qemu::QemuInvocation::build` because that
/// runs on every VM spawn and `std::env::set_var` is not thread-safe.
fn resolve_agent_host_creds_path() -> Option<PathBuf> {
    if let Ok(raw) = std::env::var("MOWS_AGENT_HOST_CREDS_PATH") {
        let path = PathBuf::from(raw);
        if path.exists() {
            return Some(path);
        }
        // Configured but missing: warn so operators notice.
        tracing::warn!(
            path = %path.display(),
            "MOWS_AGENT_HOST_CREDS_PATH is set but does not exist; guests will boot without /creds"
        );
        return None;
    }
    let fallback = PathBuf::from("/host-creds");
    fallback.exists().then_some(fallback)
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
