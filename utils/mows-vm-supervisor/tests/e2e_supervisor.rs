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
/// Static admin bearer token the harness sets via env, then re-attaches
/// on every protected request. Sized so it never collides with whatever
/// a developer might have in their shell.
const HARNESS_API_TOKEN: &str =
    "harness-static-token-fed3c1f8-e7b6-4f5e-a9b0-1ad7c0f51b2d";

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

        // Stub qcow2 so the spawn path is reachable. `locate_image` expects
        // `<image>-<flavor>-mows-agent-<arch>.qcow2`; we create stubs for
        // both `headless` (default) and `desktop` so display_mode tests
        // don't 503 on missing artefacts.
        for flavor in ["headless", "desktop"] {
            let stub_image = image_dir.join(format!(
                "alpine-{flavor}-mows-agent-amd64.qcow2"
            ));
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
                panic!("qemu-img is required for the e2e suite (skip with --skip e2e_supervisor)");
            }
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
            // SECURITY-1: TCP listener requires auth. Inject a static
            // admin token so the harness can hit protected endpoints
            // without going through `/v1/auth/login` first.
            .env("MOWS_VM_SUPERVISOR_API_TOKEN", HARNESS_API_TOKEN)
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
        // Inject the harness's static admin token on every request so
        // protected routes (post-SECURITY-1) accept the call without an
        // explicit per-test login flow. Health + login are unauthenticated
        // anyway, so the extra header is harmless on those.
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!(
                "Bearer {HARNESS_API_TOKEN}"
            ))
            .expect("static token is valid header value"),
        );
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .default_headers(headers)
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
fn unknown_agent_kind_returns_client_error() {
    // VMs are kindless — kind moved to agents. POST /v1/vms/:id/agents with
    // an unknown kind is the new failure surface. Since `AgentKindName`
    // became a typed serde enum (MAJ-7), schema rejection happens inside
    // axum's `Json` extractor, which surfaces as 422 Unprocessable Entity
    // — the correct HTTP semantic for "well-formed JSON, wrong shape".
    // We assert the request is rejected without distinguishing 400 / 422.
    let h = Harness::start(next_port());
    let resp = h
        .client()
        .post(h.url("/v1/vms/00000000-0000-0000-0000-000000000000/agents"))
        .json(&json!({"kind": "definitely-not-a-real-agent-kind"}))
        .send()
        .unwrap();
    let status = resp.status();
    assert!(
        status == reqwest::StatusCode::BAD_REQUEST
            || status == reqwest::StatusCode::UNPROCESSABLE_ENTITY,
        "unknown kind on POST must surface a 4xx client error, got {status}"
    );
}

/// QA-21: agent-create against an unknown VM with a VALID kind must 404,
/// not 500. The kind validation passes; the missing VM is the next gate
/// and must classify as not-found.
#[test]
fn create_agent_on_unknown_vm_returns_404() {
    let h = Harness::start(next_port());
    let resp = h
        .client()
        .post(h.url("/v1/vms/00000000-0000-0000-0000-000000000000/agents"))
        .json(&json!({"kind": "shell"}))
        .send()
        .unwrap();
    assert_eq!(resp.status(), reqwest::StatusCode::NOT_FOUND);
}

/// QA-21: a TCP request without a bearer token must 401, not 500, and
/// must not leak internal-error noise into the body.
#[test]
fn protected_endpoint_without_token_returns_401() {
    let h = Harness::start(next_port());
    // Bypass the harness's auto-Authorization helper by building a bare
    // reqwest client.
    let bare = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    let resp = bare.get(h.url("/v1/vms")).send().unwrap();
    assert_eq!(resp.status(), reqwest::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = resp.json().unwrap();
    assert!(
        body.get("error").is_some(),
        "401 body must be a structured {{ error: ... }} payload, got {body:?}"
    );
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
    // Password length must satisfy MIN_PASSWORD_LEN (12) — set per
    // SECURITY-2 in the same change set that added admin gating.
    let body = json!({"username": "bob", "password": "abcdefghijkl", "role": "user"});
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

/// MAJ-1 regression: `PUT /v1/vms/{vm_id}/agents/{agent_id}` must reject
/// caller-supplied ids that fail `validate_resource_name`. Path traversal
/// (`../etc`), shell metacharacters, whitespace, etc. all flow into the
/// DB primary key, tmux session name, and log file path, so the check
/// has to happen before any of that work runs.
#[test]
fn put_agent_rejects_invalid_agent_id() {
    let h = Harness::start(next_port());
    // VM id can be bogus — validate_resource_name runs first, and
    // there's no chance to reach the VM lookup with these inputs.
    let bogus_vm = "00000000-0000-0000-0000-000000000000";
    // Every case must (a) survive axum's URL routing into the
    // `{agent_id}` slot AND (b) fail `validate_resource_name`. Bare
    // `.` / `..` segments are normalized away by URL routing before
    // the handler ever sees them; the dedicated unit test in
    // `api::validation::tests::rejects_path_traversal_names` covers
    // those at the function level. Here we exercise the wire surface
    // for length, charset, and whitespace rejections.
    let too_long = "a".repeat(65);
    let cases = [
        "a%20b",    // "a b" → space reject
        "a%2Cb",    // "a,b" → comma reject
        "a%3Bb",    // "a;b" → semicolon reject
        "a%21b",    // "a!b" → exclamation reject
        too_long.as_str(),
    ];
    for bad_id in cases {
        let url = h.url(&format!("/v1/vms/{bogus_vm}/agents/{bad_id}"));
        let resp = h
            .client()
            .put(url)
            .json(&json!({"kind": "shell"}))
            .send()
            .unwrap();
        assert_eq!(
            resp.status(),
            reqwest::StatusCode::BAD_REQUEST,
            "PUT with agent_id={bad_id} must 400, got {}: {}",
            resp.status(),
            resp.text().unwrap_or_default()
        );
    }
}

/// CRIT-2/3 surface: `PUT` against an unknown VM with a valid agent_id and
/// a known kind must 404 (VM gating), not 500. Proves the explicit
/// `match` on `load_agent` doesn't swallow the NotFound and fabricate an
/// agent row anyway.
#[test]
fn put_agent_on_unknown_vm_returns_404() {
    let h = Harness::start(next_port());
    let resp = h
        .client()
        .put(h.url(
            "/v1/vms/00000000-0000-0000-0000-000000000000/agents/console_main",
        ))
        .json(&json!({"kind": "shell"}))
        .send()
        .unwrap();
    assert_eq!(resp.status(), reqwest::StatusCode::NOT_FOUND);
}

/// `PUT` against a VM that hasn't reached `running` (the stub qcow2
/// keeps the VM permanently in `starting`) must 409, not 500 — and the
/// row must not be inserted (a subsequent attempt sees the same state).
#[test]
fn put_agent_on_non_running_vm_returns_409_twice() {
    let h = Harness::start(next_port());
    let vm: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let vm_id = vm["id"].as_str().unwrap();
    let put_url = h.url(&format!("/v1/vms/{vm_id}/agents/persisted_tab"));

    let first = h
        .client()
        .put(put_url.clone())
        .json(&json!({"kind": "shell"}))
        .send()
        .unwrap();
    assert_eq!(
        first.status(),
        reqwest::StatusCode::CONFLICT,
        "stub VM is permanently `starting`, first PUT must 409"
    );

    // Second PUT must also 409 — proving that the first PUT did NOT
    // create a row that the idempotency branch then silently returned.
    let second = h
        .client()
        .put(put_url)
        .json(&json!({"kind": "shell"}))
        .send()
        .unwrap();
    assert_eq!(
        second.status(),
        reqwest::StatusCode::CONFLICT,
        "second PUT must observe the same `starting` state, not a stale row"
    );
}

/// Unknown kind values are rejected by serde before the handler runs
/// (the `AgentKindName` enum is `#[serde(rename_all = "lowercase")]`
/// over a closed set). Axum's `Json` extractor returns 422 Unprocessable
/// Entity for schema-mismatch errors, which is the correct HTTP
/// semantic (JSON is well-formed but doesn't fit the schema). Older
/// clients/docs sometimes expected 400 — assert the request is rejected
/// without distinguishing the exact 4xx code.
#[test]
fn put_agent_unknown_kind_returns_client_error() {
    let h = Harness::start(next_port());
    let resp = h
        .client()
        .put(h.url(
            "/v1/vms/00000000-0000-0000-0000-000000000000/agents/console_main",
        ))
        .json(&json!({"kind": "not-a-real-kind"}))
        .send()
        .unwrap();
    let status = resp.status();
    assert!(
        status == reqwest::StatusCode::BAD_REQUEST
            || status == reqwest::StatusCode::UNPROCESSABLE_ENTITY,
        "unknown kind must surface a 4xx client error, got {status}: {}",
        resp.text().unwrap_or_default()
    );
}

/// CRIT-1 regression: a user with `role=user` cannot list, fetch, stop,
/// or delete a VM owned by a different user. The auth disabled / admin
/// path remains unchanged (`admin` sees everything) — we exercise the
/// non-admin path explicitly here so the scoping behaviour stays under
/// test even when local-dev runs with auth disabled.
#[test]
fn non_admin_user_cannot_see_other_users_vms() {
    let h = Harness::start(next_port());

    // alice (admin) is provisioned via the harness's bootstrap token.
    // Create a VM owned by the harness admin and capture its id.
    let admin_vm: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let admin_vm_id = admin_vm["id"].as_str().unwrap();

    // Create a regular user and obtain a session token for them.
    h.client()
        .post(h.url("/v1/users"))
        .json(&json!({"username": "bob", "password": "correcthorsebatterystaple", "role": "user"}))
        .send()
        .unwrap();
    let login: serde_json::Value = h
        .client()
        .post(h.url("/v1/auth/login"))
        .json(&json!({"username": "bob", "password": "correcthorsebatterystaple"}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let bob_token = login["token"].as_str().unwrap().to_string();

    let bob = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    let with_bob = |b: reqwest::blocking::RequestBuilder| {
        b.header("Authorization", format!("Bearer {bob_token}"))
    };

    // bob sees no VMs — alice's admin-owned VM is invisible.
    let list_resp = with_bob(bob.get(h.url("/v1/vms"))).send().unwrap();
    assert!(list_resp.status().is_success());
    let list: Vec<serde_json::Value> = list_resp.json().unwrap();
    assert!(
        list.is_empty(),
        "non-admin must not see VMs owned by anyone else, got {list:?}"
    );

    // bob's targeted GET on alice's VM returns 404 (existence is not leaked).
    let get_resp =
        with_bob(bob.get(h.url(&format!("/v1/vms/{admin_vm_id}")))).send().unwrap();
    assert_eq!(get_resp.status(), reqwest::StatusCode::NOT_FOUND);

    // bob's PUT-agent against alice's VM also 404s before any
    // ownership-bypass mistake can happen.
    let put_resp = with_bob(
        bob.put(h.url(&format!(
            "/v1/vms/{admin_vm_id}/agents/tabid_cross_tenant"
        )))
        .json(&json!({"kind": "shell"})),
    )
    .send()
    .unwrap();
    assert_eq!(put_resp.status(), reqwest::StatusCode::NOT_FOUND);

    // bob's stop call must also 404.
    let stop_resp = with_bob(
        bob.post(h.url(&format!("/v1/vms/{admin_vm_id}/stop"))),
    )
    .send()
    .unwrap();
    assert_eq!(stop_resp.status(), reqwest::StatusCode::NOT_FOUND);

    // and delete.
    let delete_resp =
        with_bob(bob.delete(h.url(&format!("/v1/vms/{admin_vm_id}")))).send().unwrap();
    assert_eq!(delete_resp.status(), reqwest::StatusCode::NOT_FOUND);

    // alice (admin) still sees her VM — proves we didn't accidentally
    // also hide it from its rightful owner.
    let admin_list: Vec<serde_json::Value> = h
        .client()
        .get(h.url("/v1/vms"))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert!(admin_list.iter().any(|v| v["id"] == admin_vm_id));
}

/// VM ownership populated by `create_vm` is exposed on the row so the
/// UI can render it. Admin-created VMs carry `owner_user_id: null`
/// (admin token has no user_id), user-created VMs carry the creator's
/// `users.id`.
#[test]
fn create_vm_records_owner_user_id() {
    let h = Harness::start(next_port());

    let admin_vm: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert!(
        admin_vm["owner_user_id"].is_null(),
        "admin-created VM must record owner_user_id = null, got {admin_vm:?}"
    );

    h.client()
        .post(h.url("/v1/users"))
        .json(&json!({"username": "carol", "password": "correcthorsebatterystaple", "role": "user"}))
        .send()
        .unwrap();
    let login: serde_json::Value = h
        .client()
        .post(h.url("/v1/auth/login"))
        .json(&json!({"username": "carol", "password": "correcthorsebatterystaple"}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let carol_token = login["token"].as_str().unwrap().to_string();

    let carol = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    let user_vm: serde_json::Value = carol
        .post(h.url("/v1/vms"))
        .header("Authorization", format!("Bearer {carol_token}"))
        .json(&json!({}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let owner = user_vm["owner_user_id"].as_str().unwrap_or("");
    assert!(
        !owner.is_empty(),
        "user-created VM must record a non-empty owner_user_id, got {user_vm:?}"
    );
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
        + &format!("/v1/vms/{id}/display?token={HARNESS_API_TOKEN}");

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
        + &format!("/v1/vms/{id}/console?token={HARNESS_API_TOKEN}");

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
        + &format!(
            "/v1/vms/00000000-0000-0000-0000-000000000000/display?token={HARNESS_API_TOKEN}"
        );
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

/// QA-13: lock down the `display_mode` + `image` round-trip end-to-end.
/// The migration-0002/0003 columns are stored in sqlite and read back via
/// `GET /v1/vms/{id}` — a column-binding regression in either direction
/// silently falls back to defaults (a desktop VM would silently launch
/// headless). These tests fail loudly the moment that happens.
#[test]
fn create_with_explicit_desktop_mode_round_trips() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({
            "name": "desktop-vm",
            "image": "alpine",
            "display_mode": "desktop",
        }))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(created["display_mode"], "desktop");
    assert_eq!(created["image"], "alpine");

    let id = created["id"].as_str().unwrap();
    let row: serde_json::Value = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(row["display_mode"], "desktop");
    assert_eq!(row["image"], "alpine");
    assert_eq!(row["name"], "desktop-vm");
}

#[test]
fn create_with_explicit_resources_round_trips() {
    let h = Harness::start(next_port());
    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({
            "name": "tiny-vm",
            "image": "alpine",
            "cpus": 1,
            "memory_mb": 512,
        }))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap();
    let row: serde_json::Value = h
        .client()
        .get(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(row["cpus"], 1);
    assert_eq!(row["memory_mb"], 512);
    assert_eq!(row["image"], "alpine");
    // `display_mode` defaults to "headless" when not specified.
    assert_eq!(row["display_mode"], "headless");
}

/// `/v1/events` is the push-based replacement for the web UI's 2 s polling
/// loop. Subscribing first, then provoking VM + agent mutations, must yield
/// matching JSON events in the order they happened.
///
/// The agent half of this test depends on a live VM (REST `POST /agents`
/// rejects unreachable VMs with 409), so we only assert the VM half here.
/// The agent path is covered by the full-boot suite (`e2e_full_boot`).
#[test]
fn events_websocket_streams_vm_lifecycle() {
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::Message;

    let h = Harness::start(next_port());
    let ws_url = h
        .base_url
        .replacen("http://", "ws://", 1)
        + &format!("/v1/events?token={HARNESS_API_TOKEN}");

    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::<serde_json::Value>::new()));
    let collector = events.clone();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();

    // Subscribe BEFORE the mutation so we can't race past the create event.
    let (ready_tx, ready_rx) = std::sync::mpsc::channel::<()>();
    let ws_handle = runtime.spawn(async move {
        let (ws, _) = tokio_tungstenite::connect_async(&ws_url)
            .await
            .expect("subscribe to /v1/events");
        let (mut sink, mut stream) = ws.split();
        ready_tx.send(()).expect("ready");
        while let Some(msg) = stream.next().await {
            match msg {
                Ok(Message::Text(t)) => {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&t) {
                        collector.lock().unwrap().push(v);
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
        let _ = sink.close().await;
    });

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("ws subscribed");
    // The broadcast channel relies on the subscriber being registered
    // before `send`. The `connect_async` future completes once the upgrade
    // is acknowledged, but the server-side `forward` task that owns the
    // `Receiver` only starts after the upgrade handler returns — give it a
    // tick before publishing.
    std::thread::sleep(Duration::from_millis(150));

    let created: serde_json::Value = h
        .client()
        .post(h.url("/v1/vms"))
        .json(&json!({"detach": true}))
        .send()
        .unwrap()
        .json()
        .unwrap();
    let id = created["id"].as_str().unwrap().to_string();

    // Patch the name → VmUpdated. Stop → VmUpdated. Delete → VmDeleted.
    let _ = h
        .client()
        .patch(h.url(&format!("/v1/vms/{id}")))
        .json(&json!({"name": "renamed"}))
        .send()
        .unwrap();
    let _ = h
        .client()
        .post(h.url(&format!("/v1/vms/{id}/stop")))
        .send()
        .unwrap();
    let _ = h
        .client()
        .delete(h.url(&format!("/v1/vms/{id}")))
        .send()
        .unwrap();

    // Drain — events propagate within one tick of each REST call.
    std::thread::sleep(Duration::from_millis(400));
    ws_handle.abort();

    let collected = events.lock().unwrap().clone();
    let kinds: Vec<&str> = collected
        .iter()
        .filter(|v| v["id"] == id)
        .map(|v| v["type"].as_str().unwrap_or(""))
        .collect();

    // Must contain, in order: create, (the rename + stop emit VmUpdated),
    // delete. `vm_updated` may appear 2–4 times because the readiness
    // probe also fires one when it gives up on the stub qcow2.
    assert!(
        kinds.first() == Some(&"vm_created"),
        "first event for this id should be vm_created; got {kinds:?}"
    );
    assert!(
        kinds.last() == Some(&"vm_deleted"),
        "last event for this id should be vm_deleted; got {kinds:?}"
    );
    assert!(
        kinds.contains(&"vm_updated"),
        "expected at least one vm_updated between create/delete; got {kinds:?}"
    );
}
