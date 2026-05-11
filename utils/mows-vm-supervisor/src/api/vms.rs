//! `/v1/vms` — pure VM lifecycle (no agent kind, no credentials wiring).
//!
//! A VM is the QEMU process plus its disk overlay, port forwards, display
//! socket, and console socket. Agents (claude, shell, etc.) are spawned
//! *inside* a VM via `/v1/vms/:id/agents` (see `api::agents`).

use std::path::PathBuf;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};
use crate::qemu::{
    console_socket_for, display_socket_for, locate_image, prepare_vm_dir, spawn_qemu,
    QemuInvocation, VmLaunchSpec, VmResources,
};
use crate::state::SharedState;

pub fn router() -> Router<SharedState> {
    Router::new()
        .route("/v1/vms", get(list_vms).post(create_vm))
        .route("/v1/vms/{id}", get(get_vm).delete(delete_vm))
        .route("/v1/vms/{id}/stop", post(stop_vm))
        .route("/v1/vms/{id}/ssh", get(get_vm_ssh))
        .route("/v1/vms/{id}/display", get(get_vm_display))
        .route("/v1/vms/{id}/console", get(get_vm_console))
}

#[derive(Deserialize)]
pub struct CreateVmRequest {
    pub name: Option<String>,
    pub cwd: Option<String>,
    pub cpus: Option<u32>,
    pub memory_mb: Option<u32>,
    /// Reserved — `detach` is on the CLI side; the API always returns once
    /// QEMU is spawned and the readiness probe is in flight.
    #[serde(default)]
    pub detach: bool,
}

#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct VmSummary {
    pub id: String,
    pub name: String,
    pub status: String,
    pub host_ssh_port: Option<i64>,
    pub host_docker_port: Option<i64>,
    pub started_at: String,
    pub exited_at: Option<String>,
    pub exit_code: Option<i64>,
}

#[derive(Serialize)]
pub struct VmSshInfo {
    pub host: String,
    pub port: i64,
    pub user: String,
    pub private_key: String,
    pub public_key: String,
}

const VM_COLUMNS: &str =
    "id, name, status, host_ssh_port, host_docker_port, started_at, exited_at, exit_code";

async fn list_vms(State(state): State<SharedState>) -> Result<Json<Vec<VmSummary>>> {
    let sql = format!("SELECT {VM_COLUMNS} FROM vms ORDER BY started_at DESC");
    let rows: Vec<VmSummary> = sqlx::query_as(&sql).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

async fn get_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<VmSummary>> {
    Ok(Json(load_vm(&state, &id).await?))
}

pub(super) async fn load_vm(state: &SharedState, id: &str) -> Result<VmSummary> {
    let sql = format!("SELECT {VM_COLUMNS} FROM vms WHERE id = ?1");
    sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| SupervisorError::NotFound(format!("vm {id} not found")))
}

async fn create_vm(
    State(state): State<SharedState>,
    Json(req): Json<CreateVmRequest>,
) -> Result<Json<VmSummary>> {
    let id = uuid::Uuid::new_v4().to_string();
    let cwd_basename = req
        .cwd
        .as_deref()
        .and_then(|p| {
            std::path::Path::new(p)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| "vm".to_string());
    let name = req
        .name
        .unwrap_or_else(|| format!("{}-{}", cwd_basename, Utc::now().format("%Y%m%d-%H%M%S")));
    let started_at = Utc::now().to_rfc3339();
    let status = "starting".to_string();

    let cpus = req.cpus.unwrap_or(state.config.vm_defaults.cpus);
    let memory_mb = req.memory_mb.unwrap_or(state.config.vm_defaults.memory_mb);
    let (ssh_port, docker_port) = state.port_allocator.allocate_pair()?;

    sqlx::query(
        "INSERT INTO vms (id, name, status, cwd, host_ssh_port, host_docker_port, started_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&status)
    .bind(&req.cwd)
    .bind(i64::from(ssh_port))
    .bind(i64::from(docker_port))
    .bind(&started_at)
    .execute(&state.db)
    .await?;

    let workspace = req.cwd.as_deref().map(PathBuf::from);

    let image_path = locate_image(&state.config)?;
    let spec = VmLaunchSpec {
        vm_id: id.clone(),
        vm_name: name.clone(),
        image_path,
        state_dir: state.config.state_dir.clone(),
        workspace,
        host_ssh_port: ssh_port,
        host_docker_port: docker_port,
        resources: VmResources { cpus, memory_mb },
        authorized_ssh_pubkey: state.host_keypair.public_key.clone(),
    };

    prepare_vm_dir(&state.config, &spec).await?;
    let invocation = QemuInvocation::build(&state.config, &spec)?;

    tracing::info!(vm_id = %id, qemu = ?invocation.program, "spawning qemu");
    let child = spawn_qemu(&invocation).await?;
    let pid = child.id();

    {
        let mut reg = state.vms.write().await;
        reg.insert(id.clone(), child);
    }
    if let Some(pid) = pid {
        sqlx::query("UPDATE vms SET qemu_pid = ?1 WHERE id = ?2")
            .bind(i64::from(pid))
            .bind(&id)
            .execute(&state.db)
            .await?;
    }

    // Background readiness probe: flips status to `running` once sshd
    // answers with a banner on the forwarded host port.
    let probe_state = state.clone();
    let probe_id = id.clone();
    tokio::spawn(async move {
        match probe_until_ready(ssh_port).await {
            Ok(()) => {
                let _ = sqlx::query("UPDATE vms SET status = 'running' WHERE id = ?1 AND status = 'starting'")
                    .bind(&probe_id)
                    .execute(&probe_state.db)
                    .await;
                tracing::info!(vm_id = %probe_id, port = ssh_port, "vm reachable");
            }
            Err(e) => {
                tracing::warn!(vm_id = %probe_id, error = %e, "readiness probe failed");
                let _ = sqlx::query(
                    "UPDATE vms SET status = 'failed', exited_at = ?1 WHERE id = ?2",
                )
                .bind(Utc::now().to_rfc3339())
                .bind(&probe_id)
                .execute(&probe_state.db)
                .await;
            }
        }
    });

    let _ = req.detach;
    Ok(Json(VmSummary {
        id,
        name,
        status,
        host_ssh_port: Some(i64::from(ssh_port)),
        host_docker_port: Some(i64::from(docker_port)),
        started_at,
        exited_at: None,
        exit_code: None,
    }))
}

/// Probe the forwarded SSH port until the guest's sshd answers with an
/// `SSH-2.0-...` banner. QEMU's user-mode netdev opens the host listener
/// immediately on launch, so a bare TCP connect would give a false positive.
async fn probe_until_ready(port: u16) -> Result<()> {
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpStream;
    use tokio::time::{sleep, timeout, Instant};

    let deadline = Instant::now() + Duration::from_secs(180);
    loop {
        let attempt = async {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).await?;
            let mut buf = [0u8; 7]; // "SSH-2.0"
            timeout(Duration::from_secs(3), stream.read_exact(&mut buf))
                .await
                .map_err(|_| {
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "no banner within 3s",
                    )
                })??;
            if buf.starts_with(b"SSH-") {
                Ok::<(), std::io::Error>(())
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("unexpected banner: {:?}", String::from_utf8_lossy(&buf)),
                ))
            }
        };
        match attempt.await {
            Ok(()) => return Ok(()),
            Err(_) if Instant::now() < deadline => {
                sleep(Duration::from_millis(750)).await;
            }
            Err(e) => {
                return Err(SupervisorError::Internal(format!(
                    "sshd on 127.0.0.1:{port} did not present a banner within 180s: {e}"
                )));
            }
        }
    }
}

async fn stop_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let exited_at = Utc::now().to_rfc3339();
    let res = sqlx::query(
        "UPDATE vms SET status = 'stopped', exited_at = ?1 WHERE id = ?2 AND status != 'stopped'",
    )
    .bind(&exited_at)
    .bind(&id)
    .execute(&state.db)
    .await?;
    if res.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!(
            "vm {id} not found or already stopped"
        )));
    }
    // Reap any agents this VM hosted — their pty processes are dead the
    // moment sshd dies, but we want the database to reflect that promptly.
    let _ = sqlx::query(
        "UPDATE agents SET status = 'stopped', exited_at = ?1 \
         WHERE vm_id = ?2 AND status != 'stopped'",
    )
    .bind(&exited_at)
    .bind(&id)
    .execute(&state.db)
    .await;
    state.agent_runtimes.stop_for_vm(&id).await;
    let mut reg = state.vms.write().await;
    if let Some(mut child) = reg.remove(&id) {
        let _ = child.kill().await;
    }
    Ok(Json(serde_json::json!({"id": id, "status": "stopped"})))
}

async fn delete_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let res = sqlx::query("DELETE FROM vms WHERE id = ?1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!("vm {id} not found")));
    }
    Ok(Json(serde_json::json!({"id": id, "deleted": true})))
}

async fn get_vm_ssh(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<VmSshInfo>> {
    let summary = load_vm(&state, &id).await?;
    let port = summary.host_ssh_port.ok_or_else(|| {
        SupervisorError::NotFound(format!("vm {id} has no allocated ssh port"))
    })?;
    let private_key = tokio::fs::read_to_string(&state.host_keypair.private_key_path)
        .await
        .map_err(|e| {
            SupervisorError::Internal(format!("failed to read host private key: {e}"))
        })?;
    Ok(Json(VmSshInfo {
        host: "127.0.0.1".to_string(),
        port,
        user: "root".to_string(),
        private_key,
        public_key: state.host_keypair.public_key.clone(),
    }))
}

async fn get_vm_display(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> std::result::Result<axum::response::Response, SupervisorError> {
    let _ = load_vm(&state, &id).await?;
    let socket_path = display_socket_for(&state.config.state_dir, &id);
    Ok(ws
        .protocols(["binary"])
        .max_message_size(1 << 20)
        .max_frame_size(1 << 20)
        .on_upgrade(move |socket| async move {
            if let Err(e) = proxy_websocket_to_unix_socket(socket, &socket_path).await {
                tracing::debug!(vm_id = %id, error = %e, "display proxy ended");
            }
        }))
}

async fn get_vm_console(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> std::result::Result<axum::response::Response, SupervisorError> {
    let _ = load_vm(&state, &id).await?;
    let socket_path = console_socket_for(&state.config.state_dir, &id);
    let log_path = state
        .config
        .state_dir
        .join("vms")
        .join(&id)
        .join("console.log");
    Ok(ws
        .max_message_size(1 << 20)
        .max_frame_size(1 << 20)
        .on_upgrade(move |socket| async move {
            if let Err(e) = proxy_websocket_to_unix_socket_with_replay(
                socket,
                &socket_path,
                Some(&log_path),
            )
            .await
            {
                tracing::debug!(vm_id = %id, error = %e, "console proxy ended");
            }
        }))
}

pub(super) async fn proxy_websocket_to_unix_socket(
    ws: WebSocket,
    socket_path: &std::path::Path,
) -> std::io::Result<()> {
    proxy_websocket_to_unix_socket_with_replay(ws, socket_path, None).await
}

pub(super) async fn proxy_websocket_to_unix_socket_with_replay(
    ws: WebSocket,
    socket_path: &std::path::Path,
    replay_log: Option<&std::path::Path>,
) -> std::io::Result<()> {
    use futures_util::{SinkExt, StreamExt};
    use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
    use tokio::net::UnixStream;

    const REPLAY_BYTES: u64 = 64 * 1024;

    let unix = {
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            match UnixStream::connect(socket_path).await {
                Ok(s) => break s,
                Err(e) if std::time::Instant::now() < deadline => {
                    tracing::trace!(error = %e, "proxy: socket not ready, retrying");
                    tokio::time::sleep(Duration::from_millis(150)).await;
                }
                Err(e) => return Err(e),
            }
        }
    };

    let (mut unix_reader, mut unix_writer) = unix.into_split();
    let (mut ws_sink, mut ws_stream) = ws.split();

    if let Some(log) = replay_log {
        if let Ok(mut f) = tokio::fs::File::open(log).await {
            if let Ok(meta) = f.metadata().await {
                let len = meta.len();
                let start = len.saturating_sub(REPLAY_BYTES);
                if f.seek(std::io::SeekFrom::Start(start)).await.is_ok() {
                    let mut buf = Vec::with_capacity(REPLAY_BYTES.min(len) as usize);
                    if f.read_to_end(&mut buf).await.is_ok() && !buf.is_empty() {
                        if ws_sink.send(Message::Binary(buf.into())).await.is_err() {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    let to_ws = async move {
        let mut buf = vec![0u8; 8192];
        loop {
            let n = unix_reader.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            if ws_sink
                .send(Message::Binary(buf[..n].to_vec().into()))
                .await
                .is_err()
            {
                break;
            }
        }
        let _ = ws_sink.close().await;
        Ok::<(), std::io::Error>(())
    };

    let to_unix = async move {
        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Binary(b)) => {
                    if unix_writer.write_all(&b).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Text(t)) => {
                    if unix_writer.write_all(t.as_bytes()).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                Ok(_) => {}
            }
        }
        let _ = unix_writer.shutdown().await;
        Ok::<(), std::io::Error>(())
    };

    let (a, b) = tokio::join!(to_ws, to_unix);
    a?;
    b?;
    Ok(())
}
