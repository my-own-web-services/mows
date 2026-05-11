//! `mows vms` and `mows agents` command handlers.
//!
//! VMs are infrastructure (a QEMU process + ports + display/console
//! sockets). Agents are workloads that run inside a VM, started by the
//! supervisor over SSH and exposed via a websocket IO stream. One VM can
//! host many agents.

use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::{MowsError, Result};

use super::client::SupervisorClient;

// ---------------------------------------------------------------------------
// VM lifecycle (POST /v1/vms etc.)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct CreateVmRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cpus: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    memory_mb: Option<u32>,
    detach: bool,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
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

pub fn vm_run(
    name: Option<String>,
    cpus: Option<u32>,
    memory_mb: Option<u32>,
    no_workspace: bool,
) -> Result<()> {
    let cwd = if no_workspace { None } else { current_cwd()? };
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let summary: VmSummary = client.post(
        "/v1/vms",
        &CreateVmRequest {
            name,
            cwd,
            cpus,
            memory_mb,
            detach: true,
        },
    )?;
    println!("vm {} ({}) started — status: {}", summary.name, summary.id, summary.status);
    println!("  attach via ssh:  mows vms attach {}", summary.id);
    println!("  add an agent:    mows agents create {} --kind claude", summary.id);
    Ok(())
}

pub fn vm_list() -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vms: Vec<VmSummary> = client.get("/v1/vms")?;
    println!("{:<12} {:<32} {:<8} {:<6} {:<28}", "VM ID", "NAME", "STATUS", "SSH", "STARTED");
    for v in vms {
        println!(
            "{:<12} {:<32} {:<8} {:<6} {:<28}",
            shorten(&v.id, 12),
            v.name,
            v.status,
            v.host_ssh_port.map(|p| p.to_string()).unwrap_or_else(|| "-".into()),
            v.started_at,
        );
    }
    Ok(())
}

pub fn vm_attach(id_or_name: String) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vm = resolve_vm(&client, &id_or_name)?;
    if vm.host_ssh_port.is_none() {
        return Err(MowsError::Config(format!(
            "vm {} has no ssh port (status: {})",
            vm.id, vm.status
        )));
    }
    let ssh_info = fetch_ssh_info(&client, &vm.id)?;
    ssh_attach(&vm.id, &ssh_info)
}

pub fn vm_logs(id_or_name: String, _follow: bool) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vm = resolve_vm(&client, &id_or_name)?;
    println!(
        "vm {} ({}): status={}, started_at={}",
        vm.name, vm.id, vm.status, vm.started_at
    );
    println!("(websocket console at /v1/vms/{}/console — open in the web UI)", vm.id);
    Ok(())
}

pub fn vm_stop(id_or_name: String, _force: bool) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vm = resolve_vm(&client, &id_or_name)?;
    let _: serde_json::Value =
        client.post(&format!("/v1/vms/{}/stop", vm.id), &serde_json::json!({}))?;
    println!("vm {} stopped", vm.id);
    Ok(())
}

pub fn vm_rm(id_or_name: String) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vm = resolve_vm(&client, &id_or_name)?;
    client.delete(&format!("/v1/vms/{}", vm.id))?;
    println!("vm {} removed", vm.id);
    Ok(())
}

pub fn vm_build_image(rebuild: bool) -> Result<()> {
    let builder_dir = locate_builder_dir()?;
    println!("building Alpine guest image via {}/build.sh", builder_dir.display());
    let mut cmd = Command::new("bash");
    cmd.arg(builder_dir.join("build.sh"));
    cmd.current_dir(&builder_dir);
    if rebuild {
        cmd.env("BUILDKIT_INLINE_CACHE", "0");
    }
    let status = cmd.status().map_err(|e| MowsError::Command {
        command: "image-builder/build.sh".into(),
        message: e.to_string(),
    })?;
    if !status.success() {
        return Err(MowsError::Command {
            command: "image-builder/build.sh".into(),
            message: format!("exited with {status}"),
        });
    }
    println!("image written to {}/dist", builder_dir.display());
    Ok(())
}

// ---------------------------------------------------------------------------
// Supervisor management (was `mows tools agent supervisor`)
// ---------------------------------------------------------------------------

pub fn vm_supervisor_start() -> Result<()> {
    super::bootstrap::ensure_supervisor_running()
}

pub fn vm_supervisor_stop() -> Result<()> {
    let name = super::bootstrap::CONTAINER_NAME;
    let status = Command::new("docker")
        .args(["rm", "-f", name])
        .status()
        .map_err(|e| MowsError::Command {
            command: "docker rm".into(),
            message: e.to_string(),
        })?;
    if !status.success() {
        return Err(MowsError::Command {
            command: "docker rm".into(),
            message: format!("exited with {status}"),
        });
    }
    println!("supervisor container {name} stopped");
    Ok(())
}

pub fn vm_supervisor_status() -> Result<()> {
    let client = SupervisorClient::from_env()?;
    let val: serde_json::Value = client.get("/v1/healthz")?;
    println!("{}", serde_json::to_string_pretty(&val).unwrap_or_default());
    Ok(())
}

pub fn vm_supervisor_logs(follow: bool) -> Result<()> {
    let name = super::bootstrap::CONTAINER_NAME;
    let mut cmd = Command::new("docker");
    cmd.args(["logs", "--tail", "200"]);
    if follow {
        cmd.arg("-f");
    }
    cmd.arg(name);
    let status = cmd.status().map_err(|e| MowsError::Command {
        command: "docker logs".into(),
        message: e.to_string(),
    })?;
    if !status.success() {
        return Err(MowsError::Command {
            command: "docker logs".into(),
            message: format!("exited with {status}"),
        });
    }
    Ok(())
}

pub fn vm_supervisor_wg_config(user: String) -> Result<()> {
    let client = SupervisorClient::from_env()?;
    let resp: serde_json::Value =
        client.post("/v1/wireguard/peers", &serde_json::json!({"name": user}))?;
    println!("{}", serde_json::to_string_pretty(&resp).unwrap_or_default());
    Ok(())
}

// ---------------------------------------------------------------------------
// Agent lifecycle (POST /v1/vms/:vm_id/agents etc.)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct CreateAgentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
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

/// `mows agents run` — spawn a fresh VM, start an agent inside it, and
/// (unless `--detach`) tail the agent's stdout/stdin via the websocket.
pub fn agent_run(
    name: Option<String>,
    kind: Option<String>,
    cpus: Option<u32>,
    memory_mb: Option<u32>,
    no_workspace: bool,
    detach: bool,
) -> Result<()> {
    let cwd = if no_workspace { None } else { current_cwd()? };
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;

    // Step 1 — spawn a VM. We always pass `detach: true` here because the
    // supervisor's POST /v1/vms returns once QEMU is launched; the readiness
    // probe runs in the background and we wait for "running" below.
    let vm: VmSummary = client.post(
        "/v1/vms",
        &CreateVmRequest {
            name: name.clone(),
            cwd,
            cpus,
            memory_mb,
            detach: true,
        },
    )?;
    println!("vm {} ({}) created", vm.name, vm.id);
    let vm = wait_until_running(&client, &vm.id)?;

    // Step 2 — create the agent inside the running VM.
    let kind_name = kind.unwrap_or_else(|| "claude".to_string());
    let agent: AgentSummary = client.post(
        &format!("/v1/vms/{}/agents", vm.id),
        &CreateAgentRequest {
            kind: Some(kind_name.clone()),
            name,
        },
    )?;
    println!(
        "agent {} ({}) started in vm {} — kind: {}",
        agent.name, agent.id, vm.id, agent.kind
    );

    if detach {
        println!("running in background; attach with: mows agents attach {}", agent.id);
        return Ok(());
    }

    // Step 3 — attach to the agent's IO stream over websocket.
    attach_agent_ws(&agent.id)
}

/// `mows agents create <vm-id>` — add an agent to an existing VM.
pub fn agent_create(
    vm_id_or_name: String,
    kind: Option<String>,
    name: Option<String>,
    detach: bool,
) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let vm = resolve_vm(&client, &vm_id_or_name)?;
    if vm.status != "running" {
        return Err(MowsError::Config(format!(
            "vm {} is `{}`, must be `running` to spawn an agent",
            vm.id, vm.status
        )));
    }
    let kind_name = kind.unwrap_or_else(|| "claude".to_string());
    let agent: AgentSummary = client.post(
        &format!("/v1/vms/{}/agents", vm.id),
        &CreateAgentRequest {
            kind: Some(kind_name.clone()),
            name,
        },
    )?;
    println!(
        "agent {} ({}) started in vm {} — kind: {}",
        agent.name, agent.id, vm.id, agent.kind
    );
    if detach {
        println!("attach with: mows agents attach {}", agent.id);
        return Ok(());
    }
    attach_agent_ws(&agent.id)
}

pub fn agent_list(vm_filter: Option<String>) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let path = if let Some(vm) = &vm_filter {
        let resolved = resolve_vm(&client, vm)?;
        format!("/v1/vms/{}/agents", resolved.id)
    } else {
        "/v1/agents".to_string()
    };
    let agents: Vec<AgentSummary> = client.get(&path)?;
    println!(
        "{:<12} {:<12} {:<28} {:<10} {:<10} {:<28}",
        "AGENT ID", "VM ID", "NAME", "KIND", "STATUS", "STARTED"
    );
    for a in agents {
        println!(
            "{:<12} {:<12} {:<28} {:<10} {:<10} {:<28}",
            shorten(&a.id, 12),
            shorten(&a.vm_id, 12),
            a.name,
            a.kind,
            a.status,
            a.started_at,
        );
    }
    Ok(())
}

pub fn agent_attach(id_or_name: String) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let agent = resolve_agent(&client, &id_or_name)?;
    if agent.status == "stopped" || agent.status == "failed" {
        return Err(MowsError::Config(format!(
            "agent {} is `{}` — cannot attach (its process has exited)",
            agent.id, agent.status
        )));
    }
    attach_agent_ws(&agent.id)
}

pub fn agent_logs(id_or_name: String, _follow: bool) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let agent = resolve_agent(&client, &id_or_name)?;
    println!(
        "agent {} ({}) in vm {}: status={}, started_at={}",
        agent.name, agent.id, agent.vm_id, agent.status, agent.started_at
    );
    println!("(scrollback is replayed when you `mows agents attach {}`)", agent.id);
    Ok(())
}

pub fn agent_stop(id_or_name: String, _force: bool) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let agent = resolve_agent(&client, &id_or_name)?;
    let _: serde_json::Value = client.post(
        &format!("/v1/agents/{}/stop", agent.id),
        &serde_json::json!({}),
    )?;
    println!("agent {} stopped", agent.id);
    Ok(())
}

pub fn agent_rm(id_or_name: String) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let agent = resolve_agent(&client, &id_or_name)?;
    client.delete(&format!("/v1/agents/{}", agent.id))?;
    println!("agent {} removed", agent.id);
    Ok(())
}

/// `mows agents ui` — auto-start the supervisor (if needed) and open the
/// web UI in the system browser. With `--print`, just emit the URL so it
/// can be piped into other tooling.
pub fn agent_ui(print_only: bool) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let url = std::env::var("MOWS_VM_SUPERVISOR_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:7878".to_string());

    if print_only {
        println!("{url}");
        return Ok(());
    }

    // Pick the platform's URL opener. We don't depend on a crate for this;
    // the three commands cover Linux, macOS, and WSL/Windows.
    let opener = if std::env::consts::OS == "macos" {
        "open"
    } else if std::env::consts::OS == "windows" {
        "explorer"
    } else {
        // Linux / *BSD: xdg-open is part of xdg-utils, present on every
        // mainstream desktop. Fall back to `gnome-open` / `kde-open` only
        // if we want to be exhaustive — we don't.
        "xdg-open"
    };

    println!("opening {url} via {opener}");
    let status = Command::new(opener).arg(&url).status();
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(MowsError::Command {
            command: opener.into(),
            message: format!("exited with {s}"),
        }),
        Err(e) => {
            eprintln!(
                "could not launch a browser ({e}); open this URL manually:\n  {url}"
            );
            Err(MowsError::Command {
                command: opener.into(),
                message: e.to_string(),
            })
        }
    }
}

// ---------------------------------------------------------------------------
// User management (auth)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct CreateUserRequest {
    username: String,
    password: String,
    role: String,
}

pub fn agent_user_add(username: String, role: String) -> Result<()> {
    let password = rpassword::prompt_password(format!("password for {}: ", username))
        .unwrap_or_else(|_| String::new());
    if password.is_empty() {
        return Err(MowsError::Config("password must not be empty".into()));
    }
    let client = SupervisorClient::from_env()?;
    let resp: serde_json::Value = client.post(
        "/v1/users",
        &CreateUserRequest { username, password, role },
    )?;
    println!("{}", serde_json::to_string_pretty(&resp).unwrap_or_default());
    Ok(())
}

pub fn agent_user_list() -> Result<()> {
    let client = SupervisorClient::from_env()?;
    let resp: serde_json::Value = client.get("/v1/users")?;
    println!("{}", serde_json::to_string_pretty(&resp).unwrap_or_default());
    Ok(())
}

pub fn agent_user_passwd(_username: String) -> Result<()> {
    Err(MowsError::Config(
        "password change endpoint not yet implemented in supervisor".into(),
    ))
}

pub fn agent_user_rm(username: String) -> Result<()> {
    let client = SupervisorClient::from_env()?;
    client.delete(&format!("/v1/users/{username}"))?;
    println!("user {username} removed");
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn current_cwd() -> Result<Option<String>> {
    Ok(Some(
        std::env::current_dir()
            .map_err(|e| MowsError::io("getting current directory", e))?
            .to_string_lossy()
            .into_owned(),
    ))
}

fn resolve_vm(client: &SupervisorClient, id_or_name: &str) -> Result<VmSummary> {
    let vms: Vec<VmSummary> = client.get("/v1/vms")?;
    let matches: Vec<VmSummary> = vms
        .into_iter()
        .filter(|v| v.id == id_or_name || v.id.starts_with(id_or_name) || v.name == id_or_name)
        .collect();
    if matches.is_empty() {
        return Err(MowsError::Config(format!("no vm matches {id_or_name:?}")));
    }
    if matches.len() > 1 {
        return Err(MowsError::Config(format!(
            "ambiguous reference {id_or_name:?}: {} vms match",
            matches.len()
        )));
    }
    matches.into_iter().next().ok_or_else(|| MowsError::Config("unreachable".into()))
}

fn resolve_agent(client: &SupervisorClient, id_or_name: &str) -> Result<AgentSummary> {
    let agents: Vec<AgentSummary> = client.get("/v1/agents")?;
    let matches: Vec<AgentSummary> = agents
        .into_iter()
        .filter(|a| a.id == id_or_name || a.id.starts_with(id_or_name) || a.name == id_or_name)
        .collect();
    if matches.is_empty() {
        return Err(MowsError::Config(format!("no agent matches {id_or_name:?}")));
    }
    if matches.len() > 1 {
        return Err(MowsError::Config(format!(
            "ambiguous reference {id_or_name:?}: {} agents match",
            matches.len()
        )));
    }
    matches.into_iter().next().ok_or_else(|| MowsError::Config("unreachable".into()))
}

fn wait_until_running(client: &SupervisorClient, vm_id: &str) -> Result<VmSummary> {
    use std::thread::sleep;
    use std::time::{Duration, Instant};
    let deadline = Instant::now() + Duration::from_secs(200);
    loop {
        let vm: VmSummary = client.get(&format!("/v1/vms/{vm_id}"))?;
        if vm.status == "running" {
            return Ok(vm);
        }
        if vm.status == "failed" || vm.status == "stopped" {
            return Err(MowsError::Config(format!(
                "vm {vm_id} entered status {} before becoming reachable",
                vm.status
            )));
        }
        if Instant::now() > deadline {
            return Err(MowsError::Config(format!(
                "timed out waiting for vm {vm_id} to become reachable (last status: {})",
                vm.status
            )));
        }
        sleep(Duration::from_millis(500));
    }
}

#[derive(Debug, Deserialize)]
pub struct VmSshInfo {
    pub host: String,
    pub port: i64,
    pub user: String,
    pub private_key: String,
    #[allow(dead_code)]
    pub public_key: String,
}

fn fetch_ssh_info(client: &SupervisorClient, vm_id: &str) -> Result<VmSshInfo> {
    client.get(&format!("/v1/vms/{vm_id}/ssh"))
}

/// Returns a per-user, 0700-permissioned scratch directory for ephemeral SSH
/// material (private keys, known_hosts files). Prefers `$XDG_RUNTIME_DIR` if
/// set (per-user 0700 tmpfs on systemd hosts); otherwise creates and chmods
/// `$TMPDIR/mows-cli-$UID/`. Avoids the world-traversable `/tmp` root that
/// allowed predictable-path TOCTOU on private-key files.
fn ssh_scratch_dir() -> Result<std::path::PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    let base = match std::env::var_os("XDG_RUNTIME_DIR") {
        Some(v) if !v.is_empty() => std::path::PathBuf::from(v).join("mows-cli"),
        _ => {
            let uid = unsafe { libc::geteuid() };
            std::env::temp_dir().join(format!("mows-cli-{uid}"))
        }
    };
    if !base.exists() {
        std::fs::create_dir_all(&base)
            .map_err(|e| MowsError::io(format!("creating {}", base.display()), e))?;
    }
    std::fs::set_permissions(&base, std::fs::Permissions::from_mode(0o700))
        .map_err(|e| MowsError::io(format!("chmod 0700 {}", base.display()), e))?;
    Ok(base)
}

/// Atomically writes a private key file with 0600 perms into the per-user
/// scratch directory. Uses `create_new` so we never overwrite a file an
/// attacker might have pre-created with permissive perms (TOCTOU). If a
/// stale file from a previous run is present, it is removed first.
fn write_private_key(filename: &str, contents: &str) -> Result<std::path::PathBuf> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let path = ssh_scratch_dir()?.join(filename);
    let _ = std::fs::remove_file(&path);
    let mut f = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .mode(0o600)
        .open(&path)
        .map_err(|e| MowsError::io(format!("creating {}", path.display()), e))?;
    f.write_all(contents.as_bytes())
        .map_err(|e| MowsError::io(format!("writing {}", path.display()), e))?;
    Ok(path)
}

fn ssh_attach(vm_id: &str, info: &VmSshInfo) -> Result<()> {
    let key_path = write_private_key(&format!("mows-vm-key-{vm_id}"), &info.private_key)?;
    let known_hosts = ssh_scratch_dir()?.join(format!("mows-vm-known-hosts-{vm_id}"));
    let _ = std::fs::remove_file(&known_hosts);
    let status = Command::new("ssh")
        .arg("-i")
        .arg(&key_path)
        .arg("-p")
        .arg(info.port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", known_hosts.display()))
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg(format!("{}@{}", info.user, info.host))
        .status()
        .map_err(|e| MowsError::Command {
            command: "ssh".into(),
            message: e.to_string(),
        })?;
    let _ = std::fs::remove_file(&key_path);
    if !status.success() {
        return Err(MowsError::Command {
            command: "ssh".into(),
            message: format!("ssh exited with status {status}"),
        });
    }
    Ok(())
}

/// Attach to a live agent by ssh-ing into its VM and `tmux attach`ing to
/// the session the supervisor created for it. The user's terminal acts as
/// the real pty client — proper raw mode, no echo bouncing, no DCS reply
/// fanout. Detach with tmux's prefix-d (`Ctrl-b d` by default).
fn attach_agent_ws(agent_id: &str) -> Result<()> {
    super::bootstrap::ensure_supervisor_running()?;
    let client = SupervisorClient::from_env()?;
    let agent: AgentSummary =
        client.get(&format!("/v1/agents/{agent_id}"))?;
    let ssh_info = fetch_ssh_info(&client, &agent.vm_id)?;

    let key_path = write_private_key(&format!("mows-agent-key-{agent_id}"), &ssh_info.private_key)?;
    let known_hosts = ssh_scratch_dir()?.join(format!("mows-agent-kh-{agent_id}"));
    let _ = std::fs::remove_file(&known_hosts);

    // Tmux session naming must match the supervisor's `session_name()`.
    let session = format!("mows-{}", &agent_id[..agent_id.len().min(8)]);
    eprintln!(
        "[mows] attaching to {} (tmux session {session}); detach with Ctrl-b d",
        agent_id
    );

    let status = Command::new("ssh")
        .arg("-tt")
        .arg("-i")
        .arg(&key_path)
        .arg("-p")
        .arg(ssh_info.port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", known_hosts.display()))
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg("-o")
        .arg("ServerAliveInterval=15")
        .arg(format!("{}@{}", ssh_info.user, ssh_info.host))
        .arg(format!("tmux attach -t {session}"))
        .status()
        .map_err(|e| MowsError::Command {
            command: "ssh".into(),
            message: e.to_string(),
        })?;
    let _ = std::fs::remove_file(&key_path);
    if !status.success() {
        // tmux attach exits 0 on graceful detach; non-zero usually means
        // the session is gone (agent exited) — surface that clearly.
        eprintln!("[mows] detached from {agent_id} (ssh exited {status})");
    }
    Ok(())
}

fn locate_builder_dir() -> Result<std::path::PathBuf> {
    candidate_dirs(
        &["utils/mows-vm-supervisor/image-builder"],
        "MOWS_AGENT_IMAGE_BUILDER_DIR",
    )
}

pub(crate) fn locate_image_builder_dist() -> Result<std::path::PathBuf> {
    Ok(locate_builder_dir()?.join("dist"))
}

pub(crate) fn locate_supervisor_crate_dir() -> Result<std::path::PathBuf> {
    candidate_dirs(&["utils/mows-vm-supervisor"], "MOWS_VM_SUPERVISOR_CRATE_DIR")
}

fn candidate_dirs(suffixes: &[&str], env_override: &str) -> Result<std::path::PathBuf> {
    if let Ok(v) = std::env::var(env_override) {
        let p = std::path::PathBuf::from(v);
        if p.exists() {
            return Ok(p);
        }
    }
    let cwd = std::env::current_dir()
        .map_err(|e| MowsError::io("getting current directory", e))?;
    let mut search = cwd.clone();
    loop {
        for s in suffixes {
            let probe = search.join(s);
            if probe.exists() {
                return Ok(probe);
            }
        }
        if !search.pop() {
            break;
        }
    }
    let known_roots: &[&str] = &["/home/paul/projects/mows"];
    for root in known_roots {
        for s in suffixes {
            let probe = std::path::PathBuf::from(root).join(s);
            if probe.exists() {
                return Ok(probe);
            }
        }
    }
    Err(MowsError::Config(format!(
        "could not locate {} above {} or in known roots — set {} to override",
        suffixes.join(" or "),
        cwd.display(),
        env_override,
    )))
}

fn shorten(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…", &s[..max - 1])
    }
}
