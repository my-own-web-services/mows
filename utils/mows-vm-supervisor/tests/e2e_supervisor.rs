//! End-to-end test suite for `mows-vm-supervisor`.
//!
//! Boots the supervisor against an isolated state dir + tempfile config,
//! drives every public REST endpoint, and asserts the wire contract.
//!
//! Tests that need a bootable Alpine qcow2 (i.e. a VM that actually reaches
//! the running state) are gated on `MOWS_AGENT_E2E_FULL=1` because the
//! image is multi-GB and slow to build. The default test run uses a stub
//! qcow2 which exercises every code path up to and including QEMU spawn,
//! and asserts the readiness probe correctly STAYS in `starting` (because
//! the stub never serves an SSH banner) until the agent is stopped.

#![cfg(unix)]
#![allow(clippy::indexing_slicing)]

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

use serde_json::json;

const SUPERVISOR_BIN_ENV: &str = "MOWS_VM_SUPERVISOR_BIN";

struct Harness {
    _tempdir: tempfile::TempDir,
    config_path: PathBuf,
    state_dir: PathBuf,
    base_url: String,
    child: std::process::Child,
}

impl Harness {
    fn start(port: u16) -> Self {
        let tempdir = tempfile::tempdir().expect("tempdir");
        let state_dir = tempdir.path().join("state");
        let image_dir = state_dir.join("images");
        let socket = tempdir.path().join("agent.sock");
        std::fs::create_dir_all(&image_dir).unwrap();

        // Stub qcow2 so the spawn path is reachable.
        let stub_image = image_dir.join("alpine-mows-agent-amd64.qcow2");
        let st = Command::new("qemu-img")
            .args([
                "create",
                "-f",
                "qcow2",
                stub_image.to_str().unwrap(),
                "16M",
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if st.map(|s| !s.success()).unwrap_or(true) {
            // qemu-img unavailable — skip the whole suite by panicking in setup.
            // Cargo will surface the error clearly.
            panic!("qemu-img is required for the e2e suite (skip with --skip e2e_supervisor)");
        }

        let config_path = tempdir.path().join("config.yaml");
        std::fs::write(
            &config_path,
            format!(
                "state_dir: {state}
image_dir: {images}
unix_socket: {sock}
http_listen: 127.0.0.1:{port}
qemu_binary: qemu-system-x86_64
vm_defaults:
    cpus: 2
    memory_mb: 2048
port_range:
    start: {port_lo}
    end: {port_hi}
",
                state = state_dir.display(),
                images = image_dir.display(),
                sock = socket.display(),
                port = port,
                port_lo = port + 1000,
                port_hi = port + 1500,
            ),
        )
        .unwrap();

        let bin = std::env::var(SUPERVISOR_BIN_ENV)
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let mut p = std::env::current_exe().unwrap();
                while p.file_name().is_some_and(|n| n != "target") {
                    if !p.pop() {
                        break;
                    }
                }
                p.join("debug").join("mows-vm-supervisor")
            });
        if !bin.exists() {
            panic!(
                "supervisor binary not found at {}; build with `cargo build -p mows-vm-supervisor`",
                bin.display()
            );
        }

        let child = Command::new(&bin)
            .arg("--config")
            .arg(&config_path)
            .env("RUST_LOG", "warn")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn supervisor");

        let base_url = format!("http://127.0.0.1:{port}");

        // Block until /v1/healthz answers — bounded by 10s.
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        loop {
            if let Ok(resp) = client.get(format!("{base_url}/v1/healthz")).send() {
                if resp.status().is_success() {
                    break;
                }
            }
            if std::time::Instant::now() > deadline {
                panic!("supervisor did not become healthy within 10s on {base_url}");
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        Self {
            _tempdir: tempdir,
            config_path,
            state_dir,
            base_url,
            child,
        }
    }

    fn client(&self) -> reqwest::blocking::Client {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap()
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

impl Drop for Harness {
    fn drop(&mut self) {
        // Stop any pending agents to avoid leaving stray QEMUs around.
        let client = self.client();
        if let Ok(resp) = client.get(self.url("/v1/vms")).send() {
            if let Ok(list) = resp.json::<Vec<serde_json::Value>>() {
                for agent in list {
                    if let Some(id) = agent.get("id").and_then(|v| v.as_str()) {
                        let _ = client
                            .post(self.url(&format!("/v1/vms/{id}/stop")))
                            .send();
                    }
                }
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
        // Sweep stray QEMUs spawned by this harness using the per-state-dir path.
        let state_str = self.state_dir.to_string_lossy().to_string();
        if let Ok(out) = Command::new("pgrep").arg("-af").arg(&state_str).output() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                if let Some(pid) = line.split_whitespace().next() {
                    if line.contains("qemu-system-x86_64") {
                        let _ = Command::new("kill").arg(pid).status();
                    }
                }
            }
        }
        let _ = &self.config_path; // touched only for harness book-keeping
    }
}

fn next_port() -> u16 {
    use std::sync::atomic::{AtomicU16, Ordering};
    static SEED: AtomicU16 = AtomicU16::new(17878);
    SEED.fetch_add(1, Ordering::SeqCst)
}

#[test]
fn healthz_reports_running_supervisor() {
    let h = Harness::start(next_port());
    let resp: serde_json::Value = h
        .client()
        .get(h.url("/v1/healthz"))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(resp["status"], "ok");
    assert_eq!(resp["service"], "mows-vm-supervisor");
}

#[test]
fn create_vm_returns_starting_status_with_ports() {
    let h = Harness::start(next_port());
    let resp: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(resp["status"], "starting");
    // VMs no longer have a `kind` field — that moved to agents.
    assert!(resp.get("kind").is_none() || resp["kind"].is_null());
    assert!(resp["host_ssh_port"].as_i64().is_some());
    assert!(resp["host_docker_port"].as_i64().is_some());
    assert_ne!(resp["host_ssh_port"], resp["host_docker_port"]);
}

#[test]
fn list_after_create_includes_new_agent() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap();
    let list: Vec<serde_json::Value> = h
        .client()
        .get(h.url("/v1/vms"))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert!(list.iter().any(|a| a["id"] == id));
}

#[test]
fn stub_image_keeps_agent_in_starting() {
    // Stub qcow2 → no real sshd → readiness probe must NEVER flip status to
    // running, even after several seconds. This proves the probe doesn't
    // false-positive on QEMU's host-side port forward.
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap();

    std::thread::sleep(Duration::from_secs(4));
    let row: serde_json::Value = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(
        row["status"], "starting",
        "stub qcow2 should not advance to running; got {row:?}"
    );
}

#[test]
fn stop_terminates_running_agent() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap();
    let stop_resp = h
        .client()
        .post(h.url(&format!("/v1/vms/{id}/stop")))
        .send()
        .unwrap();
    assert!(stop_resp.status().is_success());
    let row: serde_json::Value = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(row["status"], "stopped");
}

#[test]
fn ssh_endpoint_returns_keypair_and_port() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap();
    let info: serde_json::Value = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}/ssh")))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(info["host"], "127.0.0.1");
    assert_eq!(info["user"], "root");
    assert!(info["port"].as_i64().unwrap() > 1024);
    assert!(info["public_key"]
        .as_str()
        .unwrap()
        .starts_with("ssh-ed25519 "));
    assert!(info["private_key"]
        .as_str()
        .unwrap()
        .contains("BEGIN OPENSSH PRIVATE KEY"));
}

#[test]
fn unknown_agent_kind_returns_400() {
    // VMs are kindless — kind moved to agents. POST /v1/vms/:id/agents with
    // an unknown kind is the new failure surface; it gates on the VM being
    // running, but the kind validation runs first so even before the VM is
    // ready we get a 400 here. We hit a bogus VM id to avoid bringing one up.
    let h = Harness::start(next_port());
    let resp = h
        .client()
        .post(h.url("/v1/vms/00000000-0000-0000-0000-000000000000/agents"))
        .json(&json!({"kind": "definitely-not-a-real-agent-kind"}))
        .send()
        .unwrap();
    assert_eq!(resp.status(), reqwest::StatusCode::BAD_REQUEST);
}

#[test]
fn user_create_then_login_then_list() {
    let h = Harness::start(next_port());
    let create_resp = h
        .client()
        .post(h.url("/v1/users"))
        .json(&json!({"username": "alice", "password": "correcthorsebatterystaple", "role": "admin"}))
        .send()
        .unwrap();
    assert!(create_resp.status().is_success(), "create_user failed: {}", create_resp.text().unwrap());

    let login_resp = h
        .client()
        .post(h.url("/v1/auth/login"))
        .json(&json!({"username": "alice", "password": "correcthorsebatterystaple"}))
        .send()
        .unwrap();
    assert!(login_resp.status().is_success());
    let login_json: serde_json::Value = login_resp.json().unwrap();
    assert!(login_json["token"].as_str().unwrap().len() >= 30);

    let bad_login = h
        .client()
        .post(h.url("/v1/auth/login"))
        .json(&json!({"username": "alice", "password": "wrong"}))
        .send()
        .unwrap();
    assert_eq!(bad_login.status(), reqwest::StatusCode::UNAUTHORIZED);

    let users: Vec<serde_json::Value> = h
        .client()
        .get(h.url("/v1/users"))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert!(users.iter().any(|u| u["username"] == "alice"));
}

#[test]
fn duplicate_user_returns_409() {
    let h = Harness::start(next_port());
    let body = json!({"username": "bob", "password": "abcdefgh", "role": "user"});
    let r1 = h.client().post(h.url("/v1/users")).json(&body).send().unwrap();
    assert!(r1.status().is_success());
    let r2 = h.client().post(h.url("/v1/users")).json(&body).send().unwrap();
    assert_eq!(r2.status(), reqwest::StatusCode::CONFLICT);
}

#[test]
fn delete_agent_removes_row() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap().to_string();
    let _ = h
        .client()
        .post(h.url(&format!("/v1/vms/{id}/stop")))
        .send()
        .unwrap();
    let del = h
        .client()
        .delete(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap();
    assert!(del.status().is_success());
    let after = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap();
    assert_eq!(after.status(), reqwest::StatusCode::NOT_FOUND);
}

/// Open the display websocket and verify QEMU's VNC server greets us with
/// the standard RFB protocol-version banner. This proves the full chain:
/// `-vnc unix:...` argv was emitted → QEMU bound the unix socket → axum
/// `/v1/vms/:id/display` upgraded the websocket → bytes are proxied through
/// to the browser unchanged. Works against the stub qcow2 because QEMU's
/// VNC server starts before guest boot.
#[test]
fn display_websocket_streams_rfb_banner() {
    use futures_util::StreamExt;
    use tokio_tungstenite::tungstenite::Message;

    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap().to_string();
    let ws_url = h
        .base_url
        .replacen("http://", "ws://", 1)
        + &format!("/v1/vms/{id}/display");

    let banner = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            // Wait briefly for QEMU to bind the VNC socket. The proxy itself
            // already retries internally, but its retry is bounded — we want
            // a clean test failure if the socket never appears.
            let deadline = std::time::Instant::now() + Duration::from_secs(10);
            loop {
                match tokio_tungstenite::connect_async(&ws_url).await {
                    Ok((mut ws, _)) => {
                        let msg = tokio::time::timeout(
                            Duration::from_secs(5),
                            ws.next(),
                        )
                        .await
                        .ok()
                        .and_then(|o| o)
                        .and_then(|r| r.ok());
                        return msg;
                    }
                    Err(e) if std::time::Instant::now() < deadline => {
                        tracing::trace!(error = %e, "ws connect retrying");
                        tokio::time::sleep(Duration::from_millis(200)).await;
                    }
                    Err(e) => panic!("websocket connect failed: {e}"),
                }
            }
        });

    let bytes: Vec<u8> = match banner {
        Some(Message::Binary(b)) => b.to_vec(),
        Some(Message::Text(t)) => t.as_bytes().to_vec(),
        other => panic!("expected RFB banner frame, got {other:?}"),
    };
    // RFB protocol banner is exactly 12 bytes: "RFB 003.008\n" (or .003 / .007
    // depending on QEMU version). All start with "RFB ".
    assert!(
        bytes.starts_with(b"RFB "),
        "first display frame must be the RFB banner, got {:?}",
        String::from_utf8_lossy(&bytes)
    );
}

/// Open the console websocket; the chardev unix socket is exposed by QEMU
/// the moment it starts, so the upgrade must succeed even with a stub qcow2
/// that never produces serial output. We just verify the connect+upgrade
/// path — exercising actual serial bytes requires a real Alpine boot and
/// is gated under MOWS_AGENT_E2E_FULL.
#[test]
fn console_websocket_upgrade_succeeds() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap().to_string();
    let ws_url = h
        .base_url
        .replacen("http://", "ws://", 1)
        + &format!("/v1/vms/{id}/console");

    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            let deadline = std::time::Instant::now() + Duration::from_secs(10);
            loop {
                match tokio_tungstenite::connect_async(&ws_url).await {
                    Ok((mut ws, response)) => {
                        assert_eq!(
                            response.status(),
                            tokio_tungstenite::tungstenite::http::StatusCode::SWITCHING_PROTOCOLS,
                        );
                        // Drop the connection; we've validated the upgrade.
                        let _ = futures_util::SinkExt::close(&mut ws).await;
                        return;
                    }
                    Err(e) if std::time::Instant::now() < deadline => {
                        tracing::trace!(error = %e, "ws connect retrying");
                        tokio::time::sleep(Duration::from_millis(200)).await;
                    }
                    Err(e) => panic!("console websocket connect failed: {e}"),
                }
            }
        });
}

/// Display websocket against an unknown VM id must return a clean 404
/// (i.e. NOT silently upgrade and then dangle). This guards against a
/// regression where load_vm() is omitted from the websocket route.
#[test]
fn display_websocket_unknown_vm_returns_404() {
    let h = Harness::start(next_port());
    let ws_url = h.base_url.replacen("http://", "ws://", 1)
        + "/v1/vms/00000000-0000-0000-0000-000000000000/display";
    let err = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async { tokio_tungstenite::connect_async(&ws_url).await })
        .err()
        .expect("connect must fail for unknown vm");
    let msg = format!("{err}");
    assert!(
        msg.contains("404") || msg.contains("Not Found"),
        "expected 404 from unknown vm, got: {msg}"
    );
}
