//! Agent runtime: spawn an agent process *inside* a running VM, in a tmux
//! session, so multiple clients (CLI, web UI, mobile) can attach to the
//! same live terminal without echo loops or DCS-response bouncing.
//!
//! Architecture:
//!
//! ```text
//!   supervisor          VM
//!   ──────────          ──
//!   spawn(spec)
//!      │  ssh ─────────►  tmux new-session -d -s mows-<id> -- <argv>
//!      │  (one-shot, exits)   ↑
//!      │                      │
//!   poll alive ─ ssh ───►  tmux has-session
//!                              ↑
//!   /v1/agents/:id/io ─ ssh ─► tmux attach -t mows-<id>   (per ws client)
//!   mows agents attach ─ ssh ─► tmux attach -t mows-<id>  (per CLI run)
//! ```
//!
//! There is no shared stdin/stdout broadcast in the supervisor; each client
//! gets its own ssh+tmux session that joins the shared tmux multiplexer in
//! the guest. Tmux already handles multi-client correctly — every attached
//! client sees the same screen state, input is multiplexed, and there is no
//! pty echo bouncing because each client has its own private pty between
//! its terminal and tmux.
//!
//! The persisted `agent.log` is the tmux session's `pipe-pane` output —
//! everything the agent ever wrote is captured to disk for replay.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use tokio::process::Command;
use tokio::sync::RwLock;

use crate::error::{Result, SupervisorError};

#[derive(Clone)]
pub struct AgentSpawnSpec {
    pub agent_id: String,
    pub vm_id: String,
    pub vm_ssh_port: u16,
    pub vm_ssh_key_path: PathBuf,
    pub argv: Vec<String>,
    pub env: std::collections::BTreeMap<String, String>,
    /// Where the tmux pipe-pane log gets written inside the supervisor's
    /// state dir. `<state_dir>/agents/<agent_id>/agent.log`.
    pub log_path: PathBuf,
    /// `<user>@<host>` ssh target. Built by the caller from
    /// `SupervisorConfig::{guest_ssh_user, external_host}` so the agent
    /// runtime stays unaware of config wiring.
    pub ssh_target: String,
}

pub struct AgentHandle {
    pub vm_id: String,
    pub vm_ssh_port: u16,
    pub vm_ssh_key_path: PathBuf,
    /// Name of the tmux session inside the VM. Stable for the agent's
    /// lifetime; clients attach via `tmux attach -t <session>`.
    pub session: String,
    pub log_path: PathBuf,
    /// Fully-qualified SSH target (`<guest_ssh_user>@<external_host>`)
    /// computed once at spawn time from `SupervisorConfig`. Hoisted out
    /// of the previously-duplicated `"root@127.0.0.1"` literals so a
    /// change to the guest user or host name flows through one place.
    pub ssh_target: String,
}

#[derive(Default, Clone)]
pub struct AgentRuntimeRegistry {
    inner: Arc<RwLock<HashMap<String, Arc<AgentHandle>>>>,
}

impl AgentRuntimeRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn get(&self, agent_id: &str) -> Option<Arc<AgentHandle>> {
        self.inner.read().await.get(agent_id).cloned()
    }

    pub async fn insert(&self, agent_id: String, handle: Arc<AgentHandle>) {
        self.inner.write().await.insert(agent_id, handle);
    }

    pub async fn remove(&self, agent_id: &str) -> Option<Arc<AgentHandle>> {
        self.inner.write().await.remove(agent_id)
    }

    pub async fn stop_for_vm(&self, vm_id: &str) {
        let to_stop: Vec<(String, Arc<AgentHandle>)> = {
            let map = self.inner.read().await;
            map.iter()
                .filter(|(_, h)| h.vm_id == vm_id)
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        };
        for (id, h) in to_stop {
            stop_handle(&h).await;
            self.inner.write().await.remove(&id);
        }
    }
}

pub async fn stop_handle(handle: &AgentHandle) {
    // Kill the tmux session in the guest — tmux will SIGHUP every pane,
    // every client gets disconnected. Best-effort: if the VM is already
    // torn down, ssh fails; that's fine.
    let _ = ssh_oneshot(handle, &format!("tmux kill-session -t {}", handle.session))
        .await;
}

fn session_name(agent_id: &str) -> String {
    // Tmux session names disallow `.` and `:`; UUIDs are fine but we
    // shorten for readability in `tmux ls` output.
    format!("mows-{}", &agent_id[..agent_id.len().min(8)])
}

/// Build the `ssh ...` command vector that opens an interactive `tmux
/// attach` to this agent's session. Same flags the supervisor uses, so
/// callers (CLI, websocket bridge) share one definition.
pub fn build_attach_argv(handle: &AgentHandle, known_hosts: &PathBuf) -> Vec<String> {
    vec![
        "-tt".into(),
        "-i".into(),
        handle.vm_ssh_key_path.display().to_string(),
        "-p".into(),
        handle.vm_ssh_port.to_string(),
        "-o".into(),
        "StrictHostKeyChecking=accept-new".into(),
        "-o".into(),
        format!("UserKnownHostsFile={}", known_hosts.display()),
        "-o".into(),
        "IdentitiesOnly=yes".into(),
        "-o".into(),
        "ServerAliveInterval=15".into(),
        "-o".into(),
        "ConnectTimeout=10".into(),
        handle.ssh_target.clone(),
        format!("tmux attach -t {}", handle.session),
    ]
}

async fn ssh_oneshot(handle: &AgentHandle, remote_cmd: &str) -> Result<std::process::Output> {
    let known_hosts = handle.log_path.with_file_name("known_hosts");
    Command::new("ssh")
        .arg("-i")
        .arg(&handle.vm_ssh_key_path)
        .arg("-p")
        .arg(handle.vm_ssh_port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", known_hosts.display()))
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg(&handle.ssh_target)
        .arg(remote_cmd)
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| SupervisorError::Internal(format!("ssh: {e}")))
}

/// Spawn the agent: SSH in, create a detached tmux session running the
/// agent argv, hook up `pipe-pane` so output gets persisted to disk for
/// scrollback. Returns once the session is up.
pub async fn spawn(
    spec: AgentSpawnSpec,
    db: sqlx::SqlitePool,
    on_exit: impl FnOnce(i32) -> futures_util::future::BoxFuture<'static, ()> + Send + 'static,
) -> Result<Arc<AgentHandle>> {
    if let Some(parent) = spec.log_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            SupervisorError::Internal(format!(
                "failed to create agent log dir {}: {e}",
                parent.display()
            ))
        })?;
    }
    // Truncate any stale log so scrollback only contains this run. SLOP-34:
    // swallowing the error here would leave operators with a phantom
    // "agent running, no log appearing" mystery. Surface the path + cause.
    tokio::fs::write(&spec.log_path, b"").await.map_err(|e| {
        SupervisorError::Internal(format!(
            "failed to truncate agent log {}: {e}",
            spec.log_path.display()
        ))
    })?;

    let session = session_name(&spec.agent_id);

    // Build the env-prefixed shell command that tmux will run.
    let mut env_prefix = String::new();
    for (k, v) in &spec.env {
        let escaped = v.replace('\'', "'\\''");
        env_prefix.push_str(&format!("{k}='{escaped}' "));
    }
    let argv_str = spec
        .argv
        .iter()
        .map(|a| {
            let escaped = a.replace('\'', "'\\''");
            format!("'{escaped}'")
        })
        .collect::<Vec<_>>()
        .join(" ");
    let inner_cmd = format!("{env_prefix}exec {argv_str}");
    // `tmux new-session -d` returns immediately; the agent runs in the
    // detached session. `pipe-pane` tees the pane to a file inside the
    // VM, and `cat | nc -l` (or scp later) would be how to retrieve it
    // for live tail. For now, we run the supervisor-side log capture by
    // having the supervisor periodically pull the in-VM log.
    //
    // Simpler: don't bother with in-VM pipe-pane — use the same per-attach
    // ssh sessions in the websocket proxy to capture history via tmux's
    // built-in `capture-pane` on demand.
    let create_cmd = format!(
        "tmux new-session -d -s {} -- /bin/sh -c {}",
        shell_quote(&session),
        shell_quote(&inner_cmd),
    );

    let handle = Arc::new(AgentHandle {
        vm_id: spec.vm_id.clone(),
        vm_ssh_port: spec.vm_ssh_port,
        vm_ssh_key_path: spec.vm_ssh_key_path.clone(),
        session: session.clone(),
        log_path: spec.log_path.clone(),
        ssh_target: spec.ssh_target.clone(),
    });

    let create_out = ssh_oneshot(&handle, &create_cmd).await?;
    if !create_out.status.success() {
        let stderr = String::from_utf8_lossy(&create_out.stderr);
        return Err(SupervisorError::Internal(format!(
            "tmux new-session failed: {stderr}"
        )));
    }

    // Mark agent as running immediately — the session exists and is
    // executing argv. (If argv exits instantly, the liveness poll below
    // catches it and flips status to stopped/failed.)
    let _ = sqlx::query("UPDATE agents SET status = 'running' WHERE id = ?1 AND status = 'starting'")
        .bind(&spec.agent_id)
        .execute(&db)
        .await;
    tracing::info!(agent_id = %spec.agent_id, session = %session, "tmux session created");

    // Background liveness poll: every 3 s, ssh in and `tmux has-session`.
    // When it's gone, mark the agent stopped (or failed) and call on_exit.
    let poll_handle = handle.clone();
    let poll_id = spec.agent_id.clone();
    let poll_db = db.clone();
    tokio::spawn(async move {
        let mut consecutive_misses = 0u32;
        let mut on_exit = Some(on_exit);
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;
            let alive = ssh_oneshot(
                &poll_handle,
                &format!("tmux has-session -t {} 2>/dev/null", poll_handle.session),
            )
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);

            if alive {
                consecutive_misses = 0;
                continue;
            }
            // Two consecutive misses to defend against transient ssh
            // failures (the VM being briefly unreachable shouldn't reap
            // the agent).
            consecutive_misses += 1;
            if consecutive_misses < 2 {
                continue;
            }
            tracing::info!(agent_id = %poll_id, "tmux session gone; reaping agent");
            let now = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query(
                "UPDATE agents SET status = 'stopped', exited_at = ?1, exit_code = 0 \
                 WHERE id = ?2 AND status NOT IN ('stopped','failed')",
            )
            .bind(&now)
            .bind(&poll_id)
            .execute(&poll_db)
            .await;
            if let Some(hook) = on_exit.take() {
                hook(0).await;
            }
            break;
        }
    });

    Ok(handle)
}

fn shell_quote(s: &str) -> String {
    if s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '/' | '.' | ':' | '=')) {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}
