//! `/v1/vms` — pure VM lifecycle (no agent kind, no credentials wiring).
//!
//! A VM is the QEMU process plus its disk overlay, port forwards, display
//! socket, and console socket. Agents (claude, shell, etc.) are spawned
//! *inside* a VM via `/v1/vms/:id/agents` (see `api::agents`).

use std::path::PathBuf;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::api::types::{ErrorResponse, OperationResult};
use crate::api::validation::validate_resource_name;
use crate::error::{Result, SupervisorError};
use crate::qemu::{
    console_socket_for, display_socket_for, locate_image, prepare_vm_dir, spawn_qemu,
    validate_workspace_path, vm_dir_for, DisplayMode as QemuDisplayMode, QemuInvocation,
    VmLaunchSpec, VmResources,
};
use crate::ssh_keys::{ensure_vm_keypair, vm_key_paths};
use crate::state::SharedState;

/// VM REST endpoints that participate in the OpenAPI document.
pub fn rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new()
        .routes(routes!(list_vms, create_vm))
        .routes(routes!(get_vm_defaults))
        .routes(routes!(get_vm, update_vm, delete_vm))
        .routes(routes!(stop_vm))
        .routes(routes!(get_vm_ssh))
}

/// VM websocket endpoints — not part of OpenAPI (the spec models REST only).
pub fn ws_router() -> Router<SharedState> {
    Router::new()
        .route("/v1/vms/{id}/display", get(get_vm_display))
        .route("/v1/vms/{id}/console", get(get_vm_console))
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateVmRequest {
    /// New display name. Must be non-empty.
    pub name: String,
}

/// Guest base image. Only `alpine` is currently shipped end-to-end — the
/// other variants are accepted by the API surface but `create_vm` will
/// reject them with a 503 until the image-builder lands the qcow2.
#[derive(
    Serialize, Deserialize, ToSchema, sqlx::Type, Clone, Copy, Debug, Default, PartialEq, Eq,
)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum VmImage {
    #[default]
    Alpine,
    Ubuntu,
    Debian,
    Nixos,
}

impl VmImage {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Alpine => "alpine",
            Self::Ubuntu => "ubuntu",
            Self::Debian => "debian",
            Self::Nixos => "nixos",
        }
    }
}

/// VM lifecycle status as exposed over the API. Mirrors the SQL CHECK
/// constraint in `migrations/0001_init.sql`. Serialised as the
/// lowercase variant name so the wire format stays
/// `"starting"|"running"|…` and the TypeScript codegen emits a union
/// literal instead of a bare `string` (FUTURE-14).
#[derive(
    Serialize, Deserialize, ToSchema, sqlx::Type, Clone, Copy, Debug, PartialEq, Eq,
)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum VmStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Failed,
}

impl VmStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Starting => "starting",
            Self::Running => "running",
            Self::Stopping => "stopping",
            Self::Stopped => "stopped",
            Self::Failed => "failed",
        }
    }
}

/// `headless`: SSH only, no graphical surface inside the guest.
/// `desktop`: image starts a graphical session; the supervisor's VNC
/// websocket exposes it.
#[derive(
    Serialize, Deserialize, ToSchema, sqlx::Type, Clone, Copy, Debug, Default, PartialEq, Eq,
)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum VmDisplayMode {
    #[default]
    Headless,
    Desktop,
}

impl VmDisplayMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Headless => "headless",
            Self::Desktop => "desktop",
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CreateVmRequest {
    pub name: Option<String>,
    pub cwd: Option<String>,
    pub cpus: Option<u32>,
    pub memory_mb: Option<u32>,
    /// Guest base image. Defaults to `alpine` when omitted, but the
    /// default is logged at `INFO` level so silently-defaulted requests
    /// don't hide misspelled image names (SLOP-36). Pass an explicit
    /// value (`alpine` | `ubuntu` | `debian` | `nixos`) to record intent.
    #[serde(default)]
    pub image: Option<VmImage>,
    /// Whether the guest exposes a graphical surface. Defaults to
    /// `headless` when omitted; the default is logged at `INFO` level
    /// for the same reason as `image`.
    #[serde(default)]
    pub display_mode: Option<VmDisplayMode>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct VmDefaultsResponse {
    pub cpus: u32,
    pub memory_mb: u32,
}

#[derive(Serialize, Deserialize, ToSchema, sqlx::FromRow, Clone)]
pub struct VmSummary {
    pub id: String,
    pub name: String,
    pub status: VmStatus,
    pub cwd: Option<String>,
    pub cpus: Option<i64>,
    pub memory_mb: Option<i64>,
    pub image: VmImage,
    pub display_mode: VmDisplayMode,
    pub host_ssh_port: Option<i64>,
    pub host_docker_port: Option<i64>,
    pub started_at: String,
    pub exited_at: Option<String>,
    pub exit_code: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct VmSshInfo {
    pub host: String,
    pub port: i64,
    pub user: String,
    pub private_key: String,
    pub public_key: String,
}

const VM_COLUMNS: &str =
    "id, name, status, cwd, cpus, memory_mb, image, display_mode, host_ssh_port, host_docker_port, started_at, exited_at, exit_code";

#[utoipa::path(
    get,
    path = "/v1/vms",
    tag = "vms",
    description = "List every VM, newest first.",
    responses(
        (status = 200, description = "VMs in the database", body = Vec<VmSummary>),
        (status = 500, description = "Internal error", body = ErrorResponse),
    )
)]
async fn list_vms(State(state): State<SharedState>) -> Result<Json<Vec<VmSummary>>> {
    let sql = format!("SELECT {VM_COLUMNS} FROM vms ORDER BY started_at DESC");
    let rows: Vec<VmSummary> = sqlx::query_as(&sql).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

#[utoipa::path(
    get,
    path = "/v1/vms/defaults",
    tag = "vms",
    description = "Server-side defaults applied when a `create_vm` request omits the corresponding field.",
    responses(
        (status = 200, description = "Current VM defaults", body = VmDefaultsResponse),
    )
)]
async fn get_vm_defaults(
    State(state): State<SharedState>,
) -> Result<Json<VmDefaultsResponse>> {
    Ok(Json(VmDefaultsResponse {
        cpus: state.config.vm_defaults.cpus,
        memory_mb: state.config.vm_defaults.memory_mb,
    }))
}

#[utoipa::path(
    get,
    path = "/v1/vms/{id}",
    tag = "vms",
    description = "Fetch a single VM by id.",
    params(("id" = String, Path, description = "VM id")),
    responses(
        (status = 200, description = "The VM", body = VmSummary),
        (status = 404, description = "Not found", body = ErrorResponse),
    )
)]
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

#[utoipa::path(
    post,
    path = "/v1/vms",
    tag = "vms",
    description = "Spawn a new VM. Returns once QEMU is launched; the VM is then \
                   reachable via the SSH probe (status flips to `running` when ready).",
    request_body = CreateVmRequest,
    responses(
        (status = 200, description = "VM is starting", body = VmSummary),
        (status = 500, description = "Spawn failed", body = ErrorResponse),
    )
)]
async fn create_vm(
    State(state): State<SharedState>,
    Json(request): Json<CreateVmRequest>,
) -> Result<Json<VmSummary>> {
    let id = uuid::Uuid::new_v4().to_string();

    // Validate workspace path BEFORE any side effect. Rejects relative paths,
    // missing directories, and embedded commas/newlines that would inject
    // extra QEMU `-fsdev` options.
    let workspace: Option<PathBuf> = request
        .cwd
        .as_deref()
        .map(validate_workspace_path)
        .transpose()?;
    let canonical_cwd: Option<String> = workspace
        .as_ref()
        .map(|path| path.display().to_string());

    let cwd_basename = workspace.as_deref().and_then(|path| {
        path.file_name().map(|name| name.to_string_lossy().into_owned())
    });
    // Two random words (adjective-noun) instead of a timestamp. SLOP-25:
    // if petname returns None the dictionary assets are missing — that's
    // a build regression, not a runtime condition we should paper over.
    // Surface it loud instead of fabricating a uuid-tail name.
    let suffix = petname::petname(2, "-").ok_or_else(|| {
        SupervisorError::InvalidState(
            "petname dictionary returned no name — image rebuild may have missed an asset".into(),
        )
    })?;
    let raw_name = request.name.unwrap_or_else(|| match cwd_basename {
        Some(base) => format!("{base}-{suffix}"),
        // `suffix` is consumed here (only branch that uses it bare); no
        // clone needed (TECH-RUST-17).
        None => suffix,
    });
    let name = validate_resource_name("name", &raw_name)?;
    let started_at = Utc::now().to_rfc3339();
    let status = VmStatus::Starting;

    let cpus = request.cpus.unwrap_or(state.config.vm_defaults.cpus);
    let memory_mb = request.memory_mb.unwrap_or(state.config.vm_defaults.memory_mb);
    // SLOP-36: if the caller omits `image` we still default to Alpine to
    // keep the smoke-test surface ergonomic, but surface the implicit
    // choice so operators can grep for "image=alpine" + missing-image
    // requests instead of having the default silently mask a typo.
    let image = match request.image {
        Some(image) => image,
        None => {
            tracing::info!(
                vm_id = %id,
                "create_vm: no `image` specified, defaulting to alpine"
            );
            VmImage::default()
        }
    };
    let display_mode = match request.display_mode {
        Some(mode) => mode,
        None => {
            tracing::info!(
                vm_id = %id,
                "create_vm: no `display_mode` specified, defaulting to headless"
            );
            VmDisplayMode::default()
        }
    };
    let (ssh_port, docker_port) = state.port_allocator.allocate_pair()?;

    sqlx::query(
        "INSERT INTO vms (id, name, status, cwd, cpus, memory_mb, image, display_mode, host_ssh_port, host_docker_port, started_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&id)
    .bind(&name)
    .bind(status.as_str())
    .bind(&canonical_cwd)
    .bind(i64::from(cpus))
    .bind(i64::from(memory_mb))
    .bind(image.as_str())
    .bind(display_mode.as_str())
    .bind(i64::from(ssh_port))
    .bind(i64::from(docker_port))
    .bind(&started_at)
    .execute(&state.db)
    .await?;

    // Per-VM SSH keypair: each VM owns its own ed25519 keypair under
    // `state_dir/vms/<id>/ssh/`. The public key authorizes inbound SSH; the
    // private key is what `GET /v1/vms/{id}/ssh` returns. This means
    // compromising one VM's SSH credential cannot be used to reach any other
    // VM, and the supervisor no longer needs a single master key whose leak
    // is catastrophic.
    let vm_dir = vm_dir_for(&state.config.state_dir, &id);
    tokio::fs::create_dir_all(&vm_dir).await?;
    let vm_keys = ensure_vm_keypair(&vm_dir, &id).await?;

    let artifacts = locate_image(&state.config, image.as_str(), display_mode.as_str())?;
    let spec = VmLaunchSpec {
        vm_id: id.clone(),
        vm_name: name.clone(),
        image_path: artifacts.qcow2,
        kernel_path: artifacts.kernel,
        initrd_path: artifacts.initramfs,
        state_dir: state.config.state_dir.clone(),
        workspace: workspace.clone(),
        host_ssh_port: ssh_port,
        host_docker_port: docker_port,
        resources: VmResources { cpus, memory_mb },
        authorized_ssh_pubkey: vm_keys.public_key.clone(),
        display_mode: match display_mode {
            VmDisplayMode::Headless => QemuDisplayMode::Headless,
            VmDisplayMode::Desktop => QemuDisplayMode::Desktop,
        },
    };

    prepare_vm_dir(&spec).await?;
    let invocation = QemuInvocation::build(&state.config, &spec)?;

    tracing::info!(vm_id = %id, qemu = ?invocation.program, "spawning qemu");
    let child = spawn_qemu(&invocation).await?;
    let pid = child.id();

    {
        let mut registry = state.vms.write().await;
        registry.insert(id.clone(), child);
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

    Ok(Json(VmSummary {
        id,
        name,
        status,
        cwd: canonical_cwd,
        cpus: Some(i64::from(cpus)),
        memory_mb: Some(i64::from(memory_mb)),
        image,
        display_mode,
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
            // Pin to the SSH 2.0 protocol — anything else (legacy SSH 1.x,
            // a different daemon that happens to greet with "SSH-…")
            // shouldn't flip the VM to `running`.
            let mut buf = [0u8; 8]; // "SSH-2.0-"
            timeout(Duration::from_secs(3), stream.read_exact(&mut buf))
                .await
                .map_err(|_| {
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "no banner within 3s",
                    )
                })??;
            if buf.starts_with(b"SSH-2.0-") {
                Ok::<(), std::io::Error>(())
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "unexpected ssh banner prefix: {:?}",
                        String::from_utf8_lossy(&buf)
                    ),
                ))
            }
        };
        match attempt.await {
            Ok(()) => return Ok(()),
            Err(_) if Instant::now() < deadline => {
                sleep(Duration::from_millis(750)).await;
            }
            Err(e) => {
                return Err(SupervisorError::VmBootTimeout(format!(
                    "sshd on 127.0.0.1:{port} did not present a banner within 180s: {e}"
                )));
            }
        }
    }
}

#[utoipa::path(
    post,
    path = "/v1/vms/{id}/stop",
    tag = "vms",
    description = "Stop a running VM. Reaps all agents the VM was hosting.",
    params(("id" = String, Path, description = "VM id")),
    responses(
        (status = 200, description = "VM stopped", body = OperationResult),
        (status = 404, description = "Unknown VM or already stopped", body = ErrorResponse),
    )
)]
async fn stop_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<OperationResult>> {
    // Read the port pair BEFORE we mark the VM stopped so we can release
    // them back to the allocator.
    let ports: Option<(Option<i64>, Option<i64>)> = sqlx::query_as(
        "SELECT host_ssh_port, host_docker_port FROM vms WHERE id = ?1 AND status != 'stopped'",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    let exited_at = Utc::now().to_rfc3339();
    let query_result = sqlx::query(
        "UPDATE vms SET status = 'stopped', exited_at = ?1 WHERE id = ?2 AND status != 'stopped'",
    )
    .bind(&exited_at)
    .bind(&id)
    .execute(&state.db)
    .await?;
    if query_result.rows_affected() == 0 {
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
    let mut registry = state.vms.write().await;
    if let Some(mut child) = registry.remove(&id) {
        let _ = child.kill().await;
    }
    if let Some((ssh, docker)) = ports {
        let to_release: Vec<u16> = [ssh, docker]
            .into_iter()
            .filter_map(|p| p.and_then(|v| u16::try_from(v).ok()))
            .collect();
        state.port_allocator.release(to_release);
    }
    Ok(Json(OperationResult::status(id, "stopped")))
}

#[utoipa::path(
    patch,
    path = "/v1/vms/{id}",
    tag = "vms",
    description = "Update mutable fields of a VM (currently just `name`).",
    params(("id" = String, Path, description = "VM id")),
    request_body = UpdateVmRequest,
    responses(
        (status = 200, description = "Updated VM", body = VmSummary),
        (status = 400, description = "Empty name", body = ErrorResponse),
        (status = 404, description = "Unknown VM", body = ErrorResponse),
    )
)]
async fn update_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(request): Json<UpdateVmRequest>,
) -> Result<Json<VmSummary>> {
    let trimmed = validate_resource_name("name", &request.name)?;
    let query_result = sqlx::query("UPDATE vms SET name = ?1 WHERE id = ?2")
        .bind(&trimmed)
        .bind(&id)
        .execute(&state.db)
        .await?;
    if query_result.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!("vm {id} not found")));
    }
    Ok(Json(load_vm(&state, &id).await?))
}

#[utoipa::path(
    delete,
    path = "/v1/vms/{id}",
    tag = "vms",
    description = "Delete a VM and every on-disk artefact tied to it. Irreversible.",
    params(("id" = String, Path, description = "VM id")),
    responses(
        (status = 200, description = "VM deleted", body = OperationResult),
        (status = 404, description = "Unknown VM", body = ErrorResponse),
    )
)]
async fn delete_vm(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<OperationResult>> {
    // Capture port assignments before deletion so we can release them.
    let ports: Option<(Option<i64>, Option<i64>)> =
        sqlx::query_as("SELECT host_ssh_port, host_docker_port FROM vms WHERE id = ?1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?;

    let query_result = sqlx::query("DELETE FROM vms WHERE id = ?1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if query_result.rows_affected() == 0 {
        return Err(SupervisorError::NotFound(format!("vm {id} not found")));
    }
    // Mark any agents this VM hosted as stopped (the rows survive for audit;
    // the agent_runtimes registry is dropped along with the agent's pty).
    let exited_at = Utc::now().to_rfc3339();
    let _ = sqlx::query(
        "UPDATE agents SET status = 'stopped', exited_at = ?1 \
         WHERE vm_id = ?2 AND status != 'stopped'",
    )
    .bind(&exited_at)
    .bind(&id)
    .execute(&state.db)
    .await;
    state.agent_runtimes.stop_for_vm(&id).await;

    // Tear down the QEMU child (if still running) and the per-VM on-disk
    // directory (qcow2 overlay, console.log, authorized_keys, ssh keypair,
    // run.yaml). Anything left behind would leak credentials and keep
    // resources nominally allocated.
    {
        let mut registry = state.vms.write().await;
        if let Some(mut child) = registry.remove(&id) {
            let _ = child.kill().await;
        }
    }
    let vm_dir = vm_dir_for(&state.config.state_dir, &id);
    if let Err(e) = tokio::fs::remove_dir_all(&vm_dir).await {
        // NotFound is fine — the dir was never created (e.g. spawn failed
        // before prepare_vm_dir ran). Anything else is suspicious enough
        // to surface.
        if e.kind() != std::io::ErrorKind::NotFound {
            tracing::warn!(
                vm_id = %id,
                dir = %vm_dir.display(),
                error = %e,
                "failed to remove per-vm state dir on delete"
            );
        }
    }

    if let Some((ssh, docker)) = ports {
        let to_release: Vec<u16> = [ssh, docker]
            .into_iter()
            .filter_map(|p| p.and_then(|v| u16::try_from(v).ok()))
            .collect();
        state.port_allocator.release(to_release);
    }
    Ok(Json(OperationResult::deleted(id)))
}

#[utoipa::path(
    get,
    path = "/v1/vms/{id}/ssh",
    tag = "vms",
    description = "Return host/port + the supervisor's host keypair so the caller can ssh in.",
    params(("id" = String, Path, description = "VM id")),
    responses(
        (status = 200, description = "SSH connection info", body = VmSshInfo),
        (status = 404, description = "Unknown VM", body = ErrorResponse),
    )
)]
async fn get_vm_ssh(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<VmSshInfo>> {
    let summary = load_vm(&state, &id).await?;
    let port = summary.host_ssh_port.ok_or_else(|| {
        SupervisorError::NotFound(format!("vm {id} has no allocated ssh port"))
    })?;
    let (priv_path, pub_path) = vm_key_paths(&state.config.state_dir, &id);
    let private_key = tokio::fs::read_to_string(&priv_path).await.map_err(|e| {
        SupervisorError::FilesystemError(format!(
            "failed to read per-vm private key at {}: {e}",
            priv_path.display()
        ))
    })?;
    let public_key = tokio::fs::read_to_string(&pub_path)
        .await
        .map_err(|e| {
            SupervisorError::FilesystemError(format!(
                "failed to read per-vm public key at {}: {e}",
                pub_path.display()
            ))
        })?
        .trim()
        .to_string();
    Ok(Json(VmSshInfo {
        host: state.config.external_host.clone(),
        port,
        user: state.config.guest_ssh_user.clone(),
        private_key,
        public_key,
    }))
}

async fn get_vm_display(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> std::result::Result<axum::response::Response, SupervisorError> {
    // Confirm the VM exists before upgrading; the loaded summary is unused.
    load_vm(&state, &id).await?;
    let socket_path = display_socket_for(&state.config.state_dir, &id);
    Ok(ws
        .protocols(["binary"])
        .max_message_size(WS_MAX_PAYLOAD_BYTES)
        .max_frame_size(WS_MAX_PAYLOAD_BYTES)
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
    // Confirm the VM exists before upgrading; the loaded summary is unused.
    load_vm(&state, &id).await?;
    let socket_path = console_socket_for(&state.config.state_dir, &id);
    let log_path = state
        .config
        .state_dir
        .join("vms")
        .join(&id)
        .join("console.log");
    Ok(ws
        .max_message_size(WS_MAX_PAYLOAD_BYTES)
        .max_frame_size(WS_MAX_PAYLOAD_BYTES)
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

/// Maximum websocket payload (per frame and per message). 1 MiB is large
/// enough for a single VNC frame or a generous console paste, and small
/// enough to prevent a single client from forcing the supervisor to
/// buffer arbitrarily large blobs in memory.
pub(super) const WS_MAX_PAYLOAD_BYTES: usize = 1 << 20;

/// Chunk size for the guest→ws proxy read loop. Matches typical pipe
/// buffer sizes and a single MTU's worth of payload.
pub(super) const WS_PROXY_CHUNK_BYTES: usize = 8192;

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
    use tokio::time::timeout;

    // Read at most the last 16 KiB of console scrollback. The full log can
    // be tens of MiB long; replaying all of it ties up the websocket and
    // exposes more guest-influenced bytes than a fresh attach needs.
    const REPLAY_BYTES: u64 = 16 * 1024;
    // Hard cap on a single WS attach: 4 hours. Long enough for any
    // interactive use; short enough to bound resource leaks if the client
    // disappears without closing the socket.
    const MAX_SESSION: Duration = Duration::from_secs(4 * 60 * 60);
    // Per-frame timeout on the guest→ws direction. If the unix socket has
    // gone idle for this long and the client hasn't sent anything either,
    // tear the proxy down. Generous enough for an interactive shell.
    const IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

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
        let mut read_buffer = vec![0u8; WS_PROXY_CHUNK_BYTES];
        loop {
            let read = timeout(IDLE_TIMEOUT, unix_reader.read(&mut read_buffer)).await;
            let bytes_read = match read {
                Ok(result) => result?,
                Err(_) => {
                    tracing::debug!("proxy: guest→ws idle timeout, tearing down");
                    break;
                }
            };
            if bytes_read == 0 {
                break;
            }
            if ws_sink
                .send(Message::Binary(read_buffer[..bytes_read].to_vec().into()))
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

    // tokio::join! waits for both; wrap the joined future in a session
    // timeout so a wedged client can't keep the proxy task + FD alive
    // forever.
    match timeout(MAX_SESSION, async { tokio::join!(to_ws, to_unix) }).await {
        Ok((a, b)) => {
            a?;
            b?;
            Ok(())
        }
        Err(_) => {
            tracing::info!(
                "proxy: session exceeded {} s cap, dropping",
                MAX_SESSION.as_secs()
            );
            Ok(())
        }
    }
}
