//! `/v1/vms/:vm_id/agents` and `/v1/agents/...` — agent CRUD + IO stream.
//!
//! Agents are workloads running inside a VM (one VM may host many). They're
//! spawned via SSH from the supervisor; their stdin/stdout is fanned out
//! over a websocket so the web UI can both watch and type into them.

use std::path::PathBuf;

use axum::extract::ws::{Message, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::agent_runtime::{self, AgentSpawnSpec};
use crate::api::types::{ErrorResponse, OperationResult};
use crate::error::{Result, SupervisorError};
use crate::ssh_keys::vm_key_paths;
use crate::state::SharedState;

/// Agent REST endpoints that participate in the OpenAPI document.
pub fn rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new()
        .routes(routes!(list_all_agents))
        .routes(routes!(list_vm_agents, create_agent))
        .routes(routes!(get_agent, update_agent, delete_agent))
        .routes(routes!(stop_agent))
}

/// Agent websocket endpoints — not part of OpenAPI.
pub fn ws_router() -> Router<SharedState> {
    Router::new().route("/v1/agents/{id}/io", get(get_agent_io))
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateAgentRequest {
    /// New display name. Must be non-empty.
    pub name: String,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateAgentRequest {
    /// Agent kind. Omit (or pass `null`) to fall back to the built-in
    /// `"shell"` kind — a plain `/bin/sh` session. Currently supported
    /// values: `"shell"`, `"claude"`. Anything else returns
    /// `400 Bad Request` with `UnknownKind`.
    pub kind: Option<String>,
    /// Display name. Auto-generated from `kind` + UTC timestamp when omitted.
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, sqlx::FromRow, Clone)]
pub struct AgentSummary {
    pub id: String,
    pub vm_id: String,
    pub name: String,
    pub kind: String,
    pub status: String,
    pub started_at: String,
    pub exited_at: Option<String>,
    pub exit_code: Option<i64>,
}

const AGENT_COLUMNS: &str =
    "id, vm_id, name, kind, status, started_at, exited_at, exit_code";

#[utoipa::path(
    get,
    path = "/v1/agents",
    tag = "agents",
    description = "List every agent across all VMs, newest first.",
    responses(
        (status = 200, description = "Agents in the database", body = Vec<AgentSummary>),
        (status = 500, description = "Internal error", body = ErrorResponse),
    )
)]
async fn list_all_agents(State(state): State<SharedState>) -> Result<Json<Vec<AgentSummary>>> {
    let sql = format!("SELECT {AGENT_COLUMNS} FROM agents ORDER BY started_at DESC");
    let rows: Vec<AgentSummary> = sqlx::query_as(&sql).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

#[utoipa::path(
    get,
    path = "/v1/vms/{vm_id}/agents",
    tag = "agents",
    description = "List agents inside a single VM.",
    params(("vm_id" = String, Path, description = "VM id")),
    responses(
        (status = 200, description = "Agents in this VM", body = Vec<AgentSummary>),
        (status = 500, description = "Internal error", body = ErrorResponse),
    )
)]
async fn list_vm_agents(
    State(state): State<SharedState>,
    Path(vm_id): Path<String>,
) -> Result<Json<Vec<AgentSummary>>> {
    let sql = format!(
        "SELECT {AGENT_COLUMNS} FROM agents WHERE vm_id = ?1 ORDER BY started_at DESC"
    );
    let rows: Vec<AgentSummary> = sqlx::query_as(&sql)
        .bind(&vm_id)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    get,
    path = "/v1/agents/{id}",
    tag = "agents",
    description = "Fetch a single agent by id.",
    params(("id" = String, Path, description = "Agent id")),
    responses(
        (status = 200, description = "The agent", body = AgentSummary),
        (status = 404, description = "Not found", body = ErrorResponse),
    )
)]
async fn get_agent(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<AgentSummary>> {
    Ok(Json(load_agent(&state, &id).await?))
}

async fn load_agent(state: &SharedState, id: &str) -> Result<AgentSummary> {
    let sql = format!("SELECT {AGENT_COLUMNS} FROM agents WHERE id = ?1");
    sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| SupervisorError::NotFound(format!("agent {id} not found")))
}

#[derive(sqlx::FromRow)]
struct VmRow {
    status: String,
    host_ssh_port: Option<i64>,
}

#[utoipa::path(
    post,
    path = "/v1/vms/{vm_id}/agents",
    tag = "agents",
    description = "Spawn an agent inside a running VM.",
    params(("vm_id" = String, Path, description = "VM id")),
    request_body = CreateAgentRequest,
    responses(
        (status = 200, description = "Agent is starting", body = AgentSummary),
        (status = 400, description = "Unknown kind / bad request", body = ErrorResponse),
        (status = 404, description = "VM not found", body = ErrorResponse),
    )
)]
async fn create_agent(
    State(state): State<SharedState>,
    Path(vm_id): Path<String>,
    Json(req): Json<CreateAgentRequest>,
) -> Result<Json<AgentSummary>> {
    let kind_name = req.kind.unwrap_or_else(|| "shell".to_string());
    let kind = match kind_name.as_str() {
        "shell" => crate::kinds::builtin_shell(),
        "claude" => crate::kinds::builtin_claude(),
        other => return Err(SupervisorError::UnknownKind(other.to_string())),
    };

    // Validate VM exists and is reachable.
    let vm: VmRow =
        sqlx::query_as("SELECT status, host_ssh_port FROM vms WHERE id = ?1")
            .bind(&vm_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| SupervisorError::NotFound(format!("vm {vm_id} not found")))?;
    if vm.status != "running" {
        // SLOP-23: wrong-status is a caller error, not an internal error.
        // 409 lets the client distinguish "transient — retry after the
        // readiness probe flips status" from a 500.
        return Err(SupervisorError::Conflict(format!(
            "vm {vm_id} is in status `{}`; agents can only be spawned in a running VM",
            vm.status
        )));
    }
    // SLOP-24: a missing ssh port means create_vm's INSERT was inconsistent
    // — the row got written without a port. That's data corruption, not an
    // internal handler bug, so surface it as `InvalidState` (still 500 but
    // distinct from generic Internal, and logged loudly on the operator
    // side).
    let ssh_port_i64 = vm.host_ssh_port.ok_or_else(|| {
        SupervisorError::InvalidState(format!("vm {vm_id} has no allocated ssh port"))
    })?;
    let ssh_port = u16::try_from(ssh_port_i64).map_err(|_| {
        SupervisorError::InvalidState(format!(
            "vm {vm_id} ssh port {ssh_port_i64} out of u16 range"
        ))
    })?;

    let id = uuid::Uuid::new_v4().to_string();
    let raw_name = req
        .name
        .unwrap_or_else(|| format!("{}-{}", kind_name, Utc::now().format("%Y%m%d-%H%M%S")));
    let name = crate::api::validation::validate_resource_name("name", &raw_name)?;
    let started_at = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO agents (id, vm_id, name, kind, status, started_at) \
         VALUES (?1, ?2, ?3, ?4, 'starting', ?5)",
    )
    .bind(&id)
    .bind(&vm_id)
    .bind(&name)
    .bind(&kind_name)
    .bind(&started_at)
    .execute(&state.db)
    .await?;

    let log_path = state
        .config
        .state_dir
        .join("agents")
        .join(&id)
        .join("agent.log");

    let argv = if kind.argv.is_empty() {
        vec![kind.binary.clone()]
    } else {
        kind.argv.clone()
    };
    let env: std::collections::BTreeMap<String, String> = kind.env.into_iter().collect();

    let (vm_priv_key, _) = vm_key_paths(&state.config.state_dir, &vm_id);
    let ssh_target = format!(
        "{}@{}",
        state.config.guest_ssh_user, state.config.external_host
    );
    let spec = AgentSpawnSpec {
        agent_id: id.clone(),
        vm_id: vm_id.clone(),
        vm_ssh_port: ssh_port,
        vm_ssh_key_path: PathBuf::from(vm_priv_key),
        argv,
        env,
        log_path,
        ssh_target,
    };

    // The runtimes registry needs to know to remove the entry on exit; bind
    // a closure that drops the registry slot. We capture a clone of the
    // registry handle (it's an Arc<RwLock<...>> internally).
    let registry = state.agent_runtimes.clone();
    let id_for_hook = id.clone();
    let on_exit = move |_code: i32| {
        let registry = registry.clone();
        let id = id_for_hook.clone();
        Box::pin(async move {
            registry.remove(&id).await;
        }) as futures_util::future::BoxFuture<'static, ()>
    };

    let handle = agent_runtime::spawn(spec, state.db.clone(), on_exit).await?;
    state.agent_runtimes.insert(id.clone(), handle).await;

    Ok(Json(AgentSummary {
        id,
        vm_id,
        name,
        kind: kind_name,
        status: "starting".into(),
        started_at,
        exited_at: None,
        exit_code: None,
    }))
}

#[utoipa::path(
    post,
    path = "/v1/agents/{id}/stop",
    tag = "agents",
    description = "Stop a running agent. The VM hosting it stays up.",
    params(("id" = String, Path, description = "Agent id")),
    responses(
        (status = 200, description = "Agent stopped", body = OperationResult),
        (status = 404, description = "Unknown agent or already stopped", body = ErrorResponse),
    )
)]
async fn stop_agent(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<OperationResult>> {
    let exited_at = Utc::now().to_rfc3339();
    let res = sqlx::query(
        "UPDATE agents SET status = 'stopped', exited_at = ?1 \
         WHERE id = ?2 AND status != 'stopped'",
    )
    .bind(&exited_at)
    .bind(&id)
    .execute(&state.db)
    .await?;
    if res.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!(
            "agent {id} not found or already stopped"
        )));
    }
    if let Some(handle) = state.agent_runtimes.remove(&id).await {
        agent_runtime::stop_handle(&handle).await;
    }
    Ok(Json(OperationResult::status(id, "stopped")))
}

#[utoipa::path(
    patch,
    path = "/v1/agents/{id}",
    tag = "agents",
    description = "Update mutable fields of an agent (currently just `name`).",
    params(("id" = String, Path, description = "Agent id")),
    request_body = UpdateAgentRequest,
    responses(
        (status = 200, description = "Updated agent", body = AgentSummary),
        (status = 400, description = "Empty name", body = ErrorResponse),
        (status = 404, description = "Unknown agent", body = ErrorResponse),
    )
)]
async fn update_agent(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateAgentRequest>,
) -> Result<Json<AgentSummary>> {
    let trimmed = crate::api::validation::validate_resource_name("name", &req.name)?;
    let res = sqlx::query("UPDATE agents SET name = ?1 WHERE id = ?2")
        .bind(&trimmed)
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!("agent {id} not found")));
    }
    Ok(Json(load_agent(&state, &id).await?))
}

#[utoipa::path(
    delete,
    path = "/v1/agents/{id}",
    tag = "agents",
    description = "Delete an agent and its on-disk state. The VM stays running.",
    params(("id" = String, Path, description = "Agent id")),
    responses(
        (status = 200, description = "Agent deleted", body = OperationResult),
        (status = 404, description = "Unknown agent", body = ErrorResponse),
    )
)]
async fn delete_agent(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<OperationResult>> {
    let res = sqlx::query("DELETE FROM agents WHERE id = ?1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!("agent {id} not found")));
    }
    Ok(Json(OperationResult::deleted(id)))
}

/// Bidirectional websocket bound to a fresh ssh+`tmux attach` session
/// inside the VM. Each websocket connection gets its own private pty and
/// joins the agent's shared tmux session — so multi-client works (tmux's
/// native multi-attach), each client's terminal queries (DECRQSS, focus
/// reports, DA1) get their own isolated reply path, and there is no echo
/// bouncing between clients.
async fn get_agent_io(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> std::result::Result<axum::response::Response, SupervisorError> {
    // Confirm the agent exists before upgrading; loaded summary unused.
    load_agent(&state, &id).await?;
    let runtime = state
        .agent_runtimes
        .get(&id)
        .await
        .ok_or_else(|| SupervisorError::NotFound(format!(
            "agent {id} has no live runtime (stopped or never started)"
        )))?;
    Ok(ws
        .max_message_size(1 << 20)
        .max_frame_size(1 << 20)
        .on_upgrade(move |socket| async move {
            if let Err(e) = proxy_agent_io(socket, runtime).await {
                tracing::debug!(agent_id = %id, error = %e, "agent io proxy ended");
            }
        })
        .into_response())
}

async fn proxy_agent_io(
    ws: axum::extract::ws::WebSocket,
    handle: std::sync::Arc<crate::agent_runtime::AgentHandle>,
) -> std::io::Result<()> {
    use futures_util::{SinkExt, StreamExt};
    use std::process::Stdio;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::process::Command;

    // Per-attach known_hosts so a future server-key rotation doesn't
    // poison parallel connections.
    let known_hosts = handle
        .log_path
        .with_file_name(format!(
            "known_hosts.ws-{}",
            uuid::Uuid::new_v4().simple()
        ));
    let _ = tokio::fs::remove_file(&known_hosts).await;

    // RAII guard: even if the WS proxy tasks below panic or are cancelled
    // mid-flight, dropping the guard removes the per-attach known_hosts
    // file so we don't accumulate orphans under state_dir/agents/.
    // tokio::fs is async, so the Drop impl falls back to std::fs.
    struct KnownHostsGuard(std::path::PathBuf);
    impl Drop for KnownHostsGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    let _known_hosts_guard = KnownHostsGuard(known_hosts.clone());

    let argv = crate::agent_runtime::build_attach_argv(&handle, &known_hosts);

    let mut ssh = Command::new("ssh")
        .args(&argv)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("spawn ssh: {e}")))?;

    let mut ssh_stdout = ssh.stdout.take().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::BrokenPipe,
            "ssh child reported no stdout despite Stdio::piped()",
        )
    })?;
    let mut ssh_stdin = ssh.stdin.take().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::BrokenPipe,
            "ssh child reported no stdin despite Stdio::piped()",
        )
    })?;

    let (mut sink, mut stream) = ws.split();

    let ws_to_ssh = async move {
        while let Some(msg) = stream.next().await {
            match msg {
                Ok(Message::Binary(b)) => {
                    if ssh_stdin.write_all(&b).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Text(t)) => {
                    if ssh_stdin.write_all(t.as_bytes()).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                Ok(_) => {}
            }
        }
        let _ = ssh_stdin.shutdown().await;
        Ok::<(), std::io::Error>(())
    };

    let ssh_to_ws = async move {
        let mut read_buffer = vec![0u8; super::vms::WS_PROXY_CHUNK_BYTES];
        loop {
            let bytes_read = ssh_stdout.read(&mut read_buffer).await?;
            if bytes_read == 0 {
                break;
            }
            if sink
                .send(Message::Binary(read_buffer[..bytes_read].to_vec().into()))
                .await
                .is_err()
            {
                break;
            }
        }
        let _ = sink.close().await;
        Ok::<(), std::io::Error>(())
    };

    let (ws_to_ssh_result, ssh_to_ws_result) = tokio::join!(ws_to_ssh, ssh_to_ws);
    let _ = ssh.kill().await;
    // _known_hosts_guard drops here, removing the file regardless of
    // whether the proxy tasks returned cleanly.
    ws_to_ssh_result?;
    ssh_to_ws_result?;
    Ok(())
}
