//! Auto-start the containerised mows-vm-supervisor.
//!
//! Goal: any `mows {vms,agents} <cmd>` that needs the supervisor brings
//! the container up automatically — no separate "supervisor start" step,
//! and **no compose project**: we drive Docker directly via `docker run`.
//!
//! If the image doesn't exist yet, we build it from the Dockerfile at
//! `utils/mows-vm-supervisor/`.
//!
//! The container runs with `--network host` so each agent VM's QEMU
//! port-forwards (ssh on `127.0.0.1:NNNN`) appear directly on the host
//! loopback, where `mows vms attach` and `mows agents attach` connect.
//! It also gets:
//!   - `/dev/kvm` + `/dev/net/tun` device passthrough
//!   - `--cap-add NET_ADMIN,SYS_ADMIN` (KVM + 9p + future WireGuard)
//!   - bind-mount of `${HOME}/.local/state/mows-agent → /var/lib/mows-agent`
//!   - bind-mount of `${HOME} → ${HOME}` rw (so workspace 9p paths the user
//!     sends in CreateVmRequest resolve identically inside the container)
//!   - bind-mount of `${HOME}/.claude → /host-creds:ro` (claude tokens)

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use colored::Colorize;

use crate::error::{MowsError, Result};

const SUPERVISOR_URL: &str = "http://127.0.0.1:7878";
const IMAGE_TAG: &str = "mows-vm-supervisor:dev";
pub(super) const CONTAINER_NAME: &str = "mows-vm-supervisor";

pub fn ensure_supervisor_running() -> Result<()> {
    if probe_healthz(Duration::from_millis(400)) {
        return Ok(());
    }

    let home = std::env::var("HOME")
        .map_err(|_| MowsError::Config("HOME is not set".into()))?;
    let state_dir = PathBuf::from(&home).join(".local/state/mows-agent");
    let image_dir = state_dir.join("images");
    fs::create_dir_all(&image_dir)
        .map_err(|e| MowsError::io(format!("creating {}", image_dir.display()), e))?;

    eprintln!(
        "{} {}",
        "▶".cyan().bold(),
        "supervisor not running — auto-starting it as a Docker container".bold()
    );
    eprintln!(
        "  {}     {}",
        "manual:".dimmed(),
        "mows vms supervisor start".cyan()
    );
    eprintln!(
        "  {}       {}",
        "stop:".dimmed(),
        "mows vms supervisor stop".cyan()
    );
    eprintln!(
        "  {}  {}",
        "container:".dimmed(),
        format!("docker logs -f {CONTAINER_NAME}").cyan()
    );

    require_docker()?;
    ensure_supervisor_image_built()?;
    ensure_guest_image_built(&image_dir)?;
    write_runtime_config(&state_dir)?;
    docker_run(&state_dir, &home)?;

    let deadline = Instant::now() + Duration::from_secs(30);
    while !probe_healthz(Duration::from_millis(400)) {
        if Instant::now() > deadline {
            return Err(MowsError::Config(format!(
                "supervisor container failed to become healthy within 30s — see `docker logs {CONTAINER_NAME}`"
            )));
        }
        sleep(Duration::from_millis(400));
    }
    eprintln!(
        "  {} container up; supervisor reachable at {}",
        "✓".green(),
        SUPERVISOR_URL.cyan()
    );
    Ok(())
}

fn probe_healthz(timeout: Duration) -> bool {
    let client = reqwest::blocking::Client::builder().timeout(timeout).build();
    let Ok(client) = client else { return false };
    matches!(
        client.get(format!("{SUPERVISOR_URL}/v1/healthz")).send(),
        Ok(r) if r.status().is_success()
    )
}

fn require_docker() -> Result<()> {
    let ok = Command::new("docker")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !ok {
        return Err(MowsError::Config(
            "docker is required for the supervisor container; install it or run \
             the supervisor binary directly with --config <path>"
                .into(),
        ));
    }
    Ok(())
}

fn image_exists(tag: &str) -> bool {
    let out = Command::new("docker")
        .args(["images", "-q", tag])
        .output();
    matches!(out, Ok(o) if !o.stdout.is_empty())
}

fn ensure_supervisor_image_built() -> Result<()> {
    if image_exists(IMAGE_TAG) {
        return Ok(());
    }
    let crate_dir = super::commands::locate_supervisor_crate_dir()?;
    let log_path = state_dir_path()?.join("supervisor-image-build.log");
    eprintln!(
        "{} {}",
        "▶".cyan().bold(),
        format!("building {IMAGE_TAG} (one-time, ~3 min)…").bold()
    );
    eprintln!(
        "  {}      {}",
        "log:".dimmed(),
        log_path.display().to_string().cyan()
    );

    let log = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .map_err(|e| MowsError::io(format!("opening {}", log_path.display()), e))?;
    let log_err = log
        .try_clone()
        .map_err(|e| MowsError::io("cloning log handle", e))?;

    eprint!("  ");
    let mut child = Command::new("docker")
        .args([
            "buildx",
            "build",
            "-t",
            IMAGE_TAG,
            "--build-arg",
            "PROFILE=dev",
            "--build-arg",
            "SERVICE_NAME=mows-vm-supervisor",
            "--build-context",
            "lock=../..",
            ".",
        ])
        .current_dir(&crate_dir)
        .env("DOCKER_BUILDKIT", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn()
        .map_err(|e| MowsError::Command {
            command: "docker buildx build".into(),
            message: e.to_string(),
        })?;
    while child
        .try_wait()
        .map_err(|e| MowsError::Command {
            command: "docker buildx build".into(),
            message: e.to_string(),
        })?
        .is_none()
    {
        eprint!(".");
        let _ = std::io::stderr().flush();
        sleep(Duration::from_secs(5));
    }
    eprintln!();
    let status = child.wait().map_err(|e| MowsError::Command {
        command: "docker buildx build".into(),
        message: e.to_string(),
    })?;
    if !status.success() {
        return Err(MowsError::Command {
            command: "docker buildx build".into(),
            message: format!("exited with {status} — see {}", log_path.display()),
        });
    }
    eprintln!("  {} {}", "✓".green(), "supervisor image built".dimmed());
    Ok(())
}

fn ensure_guest_image_built(image_dir: &Path) -> Result<()> {
    let arch = std::env::consts::ARCH;
    let arch_name = match arch {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        other => other,
    };
    if image_dir
        .join(format!("alpine-mows-agent-{arch_name}.qcow2"))
        .exists()
    {
        return Ok(());
    }
    let build_log = state_dir_path()?.join("image-build.log");
    eprintln!(
        "{} {}",
        "▶".cyan().bold(),
        "building Alpine guest image (one-time, ~3 min)…".bold()
    );
    eprintln!(
        "  {}      {}",
        "log:".dimmed(),
        build_log.display().to_string().cyan()
    );
    let builder_dir = super::commands::locate_image_builder_dist()?
        .parent()
        .ok_or_else(|| MowsError::Config("image-builder dir has no parent".into()))?
        .to_path_buf();
    let log = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&build_log)
        .map_err(|e| MowsError::io(format!("opening {}", build_log.display()), e))?;
    let log_err = log
        .try_clone()
        .map_err(|e| MowsError::io("cloning log handle", e))?;
    eprint!("  ");
    let mut child = Command::new("bash")
        .arg(builder_dir.join("build.sh"))
        .current_dir(&builder_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn()
        .map_err(|e| MowsError::Command {
            command: "image-builder/build.sh".into(),
            message: e.to_string(),
        })?;
    while child
        .try_wait()
        .map_err(|e| MowsError::Command {
            command: "image-builder/build.sh".into(),
            message: e.to_string(),
        })?
        .is_none()
    {
        eprint!(".");
        let _ = std::io::stderr().flush();
        sleep(Duration::from_secs(5));
    }
    eprintln!();
    let status = child.wait().map_err(|e| MowsError::Command {
        command: "image-builder/build.sh".into(),
        message: e.to_string(),
    })?;
    if !status.success() {
        return Err(MowsError::Command {
            command: "image-builder/build.sh".into(),
            message: format!("exited with {status} — see {}", build_log.display()),
        });
    }
    // Copy the built artefacts into the state image_dir so the container
    // (which mounts state_dir at /var/lib/mows-agent) can see them.
    let dist = super::commands::locate_image_builder_dist()?;
    fs::create_dir_all(image_dir)
        .map_err(|e| MowsError::io(format!("creating {}", image_dir.display()), e))?;
    for entry in fs::read_dir(&dist)
        .map_err(|e| MowsError::io(format!("reading {}", dist.display()), e))?
    {
        let entry = entry
            .map_err(|e| MowsError::io(format!("reading {}", dist.display()), e))?;
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name() {
                let dest = image_dir.join(name);
                fs::copy(&path, &dest)
                    .map_err(|e| MowsError::io(format!("copying to {}", dest.display()), e))?;
            }
        }
    }
    eprintln!(
        "  {} guest image staged in {}",
        "✓".green(),
        image_dir.display().to_string().dimmed()
    );
    Ok(())
}

fn state_dir_path() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| MowsError::Config("HOME is not set".into()))?;
    let p = PathBuf::from(home).join(".local/state/mows-agent");
    fs::create_dir_all(&p)
        .map_err(|e| MowsError::io(format!("creating {}", p.display()), e))?;
    Ok(p)
}

fn write_runtime_config(state_dir: &Path) -> Result<()> {
    // Container needs its own config file pointing at the in-container
    // /var/lib/mows-agent paths. Bind-mounted read-only by docker_run.
    let config_path = state_dir.join("config.yaml");
    let config_body = "\
        state_dir: /var/lib/mows-agent\n\
        image_dir: /var/lib/mows-agent/images\n\
        unix_socket: /var/lib/mows-agent/agent.sock\n\
        http_listen: 127.0.0.1:7878\n\
        qemu_binary: qemu-system-x86_64\n\
        vm_defaults:\n    cpus: 2\n    memory_mb: 2048\n\
        port_range:\n    start: 22000\n    end: 22999\n";
    fs::write(&config_path, config_body)
        .map_err(|e| MowsError::io(format!("writing {}", config_path.display()), e))?;
    Ok(())
}

fn docker_run(state_dir: &Path, home: &str) -> Result<()> {
    // If a stale container with our name exists (stopped or otherwise), wipe
    // it so `docker run --name` succeeds.
    let _ = Command::new("docker")
        .args(["rm", "-f", CONTAINER_NAME])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    let claude_dir = PathBuf::from(home).join(".claude");
    let state_str = state_dir.display().to_string();
    let config_str = state_dir.join("config.yaml").display().to_string();

    let mut args: Vec<String> = vec![
        "run".into(),
        "-d".into(),
        "--name".into(),
        CONTAINER_NAME.into(),
        "--restart".into(),
        "unless-stopped".into(),
        "--network".into(),
        "host".into(),
        "--cap-add".into(),
        "NET_ADMIN".into(),
        "--cap-add".into(),
        "SYS_ADMIN".into(),
        "--device".into(),
        "/dev/kvm".into(),
        "--device".into(),
        "/dev/net/tun".into(),
        "-e".into(),
        "MOWS_VM_SUPERVISOR_CONFIG=/etc/mows-vm-supervisor/config.yaml".into(),
        "-e".into(),
        "MOWS_AGENT_HOST_CREDS_PATH=/host-creds".into(),
        "-e".into(),
        format!("RUST_LOG={}", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into())),
        "-v".into(),
        format!("{state_str}:/var/lib/mows-agent"),
        "-v".into(),
        format!("{config_str}:/etc/mows-vm-supervisor/config.yaml:ro"),
        // The user's $HOME is bind-mounted rw so any path the user gave as a
        // VM workspace (host CWD) resolves identically inside the container.
        "-v".into(),
        format!("{home}:{home}"),
        // /tmp is also bind-mounted: a common pattern (and our own e2e
        // tests) is `mktemp -d` for an ad-hoc workspace, which resolves
        // under /tmp on Linux. Without this, QEMU's 9p fsdev fails to
        // open the path inside the container and the VM never boots.
        "-v".into(),
        "/tmp:/tmp".into(),
    ];
    if claude_dir.exists() {
        args.push("-v".into());
        args.push(format!("{}:/host-creds:ro", claude_dir.display()));
        eprintln!(
            "  {} forwarding host {} → guest /creds (read-only)",
            "✓".green(),
            claude_dir.display().to_string().dimmed()
        );
    }
    args.push(IMAGE_TAG.into());

    let out = Command::new("docker")
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| MowsError::Command {
            command: "docker run".into(),
            message: e.to_string(),
        })?;
    if !out.status.success() {
        return Err(MowsError::Command {
            command: "docker run".into(),
            message: format!(
                "exited with {}: {}",
                out.status,
                String::from_utf8_lossy(&out.stderr).trim()
            ),
        });
    }
    Ok(())
}

