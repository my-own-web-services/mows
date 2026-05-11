//! Full-boot e2e tests — these tests boot a real Alpine guest in QEMU and
//! exercise the entire stack end-to-end (api → spawn → boot → ssh → console
//! → stop). They're SLOW (~30 s/boot) and require:
//!   - `/dev/kvm` access (real KVM)
//!   - a built guest qcow2 image at `MOWS_AGENT_FULL_IMAGE` (or the default
//!     `~/.local/state/mows-agent/images/alpine-mows-agent-amd64.qcow2`)
//!   - the supervisor binary on disk (built by `cargo build`)
//!   - the system `ssh` binary
//!
//! All tests are `#[ignore]` and only run with:
//!   cargo test -p mows-vm-supervisor --test e2e_full_boot -- --ignored
//!
//! They exist precisely because the cheap stub-qcow2 e2e suite cannot catch
//! regressions in the actual boot path: kernel/initrd args, mows-agent-init
//! service, sshd authorized_keys propagation, 9p mount lifecycle, etc.

#![cfg(unix)]
#![allow(clippy::indexing_slicing)]

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::json;

const SUPERVISOR_BIN_ENV: &str = "MOWS_VM_SUPERVISOR_BIN";
const FULL_IMAGE_ENV: &str = "MOWS_AGENT_FULL_IMAGE";

fn require_full_image() -> PathBuf {
    let from_env = std::env::var(FULL_IMAGE_ENV).ok().map(PathBuf::from);
    let default = dirs_home_state()
        .join("mows-agent/images/alpine-mows-agent-amd64.qcow2");
    let p = from_env.unwrap_or(default);
    assert!(
        p.exists(),
        "full-boot e2e requires a built guest image at {} \
         (set {FULL_IMAGE_ENV} to override). Build with \
         `mows tools agent build-image`.",
        p.display(),
    );
    p
}

fn dirs_home_state() -> PathBuf {
    std::env::var("XDG_STATE_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".local/state"))
        })
        .expect("HOME or XDG_STATE_HOME must be set")
}

fn require_kvm() {
    let kvm = std::path::Path::new("/dev/kvm");
    assert!(
        kvm.exists(),
        "/dev/kvm not present — full-boot e2e requires KVM",
    );
}

fn require_ssh() {
    let st = Command::new("ssh")
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    assert!(
        matches!(st, Ok(s) if s.success()),
        "system `ssh` binary not on PATH — needed for full-boot e2e",
    );
}

struct FullHarness {
    _tempdir: tempfile::TempDir,
    state_dir: PathBuf,
    base_url: String,
    child: std::process::Child,
}

impl FullHarness {
    fn start(port: u16) -> Self {
        Self::start_with_creds(port, None)
    }

    /// Start a harness with `MOWS_AGENT_HOST_CREDS_PATH` overridden in the
    /// supervisor's environment. Used by tests that simulate specific creds
    /// states (missing, empty `.claude.json`, valid backup, etc.) so we can
    /// reproduce the kinds of edge cases users hit.
    fn start_with_creds(port: u16, creds_override: Option<PathBuf>) -> Self {
        require_kvm();
        require_ssh();
        let image = require_full_image();

        let tempdir = tempfile::tempdir().expect("tempdir");
        let state_dir = tempdir.path().join("state");
        let image_dir = state_dir.join("images");
        let socket = tempdir.path().join("agent.sock");
        std::fs::create_dir_all(&image_dir).unwrap();

        // Hard-link the cached qcow2 into the test image_dir (cp would
        // double the disk usage; symlink would defeat qemu's copy-on-write
        // overlay logic on some filesystems).
        let target = image_dir.join("alpine-mows-agent-amd64.qcow2");
        if std::fs::hard_link(&image, &target).is_err() {
            std::fs::copy(&image, &target).expect("copy image");
        }
        // Kernel + initramfs sit next to the qcow2 in the real image dir;
        // pull them in so direct -kernel boot works.
        for name in ["alpine-mows-agent-amd64.vmlinuz", "alpine-mows-agent-amd64.initramfs"] {
            let src = image.with_file_name(name);
            if src.exists() {
                let dst = image_dir.join(name);
                let _ = std::fs::hard_link(&src, &dst).or_else(|_| std::fs::copy(&src, &dst).map(|_| ()));
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
        assert!(
            bin.exists(),
            "supervisor binary not found at {}; build with `cargo build -p mows-vm-supervisor`",
            bin.display(),
        );

        let mut cmd = Command::new(&bin);
        cmd.arg("--config")
            .arg(&config_path)
            .env("RUST_LOG", "info");
        if let Some(creds) = creds_override.as_ref() {
            cmd.env("MOWS_AGENT_HOST_CREDS_PATH", creds);
        }
        let child = cmd
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn supervisor");

        let base_url = format!("http://127.0.0.1:{port}");
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if let Ok(resp) = client.get(format!("{base_url}/v1/healthz")).send() {
                if resp.status().is_success() {
                    break;
                }
            }
            if Instant::now() > deadline {
                panic!("supervisor did not become healthy within 10s on {base_url}");
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        Self {
            _tempdir: tempdir,
            state_dir,
            base_url,
            child,
        }
    }

    fn client(&self) -> reqwest::blocking::Client {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap()
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn create_vm(&self) -> serde_json::Value {
        self.client()
            .post(self.url("/v1/vms"))
            .json(&json!({"detach": true}))
            .send()
            .expect("create_vm")
            .json()
            .expect("parse json")
    }

    fn create_agent(&self, vm_id: &str, kind: &str) -> serde_json::Value {
        self.client()
            .post(self.url(&format!("/v1/vms/{vm_id}/agents")))
            .json(&json!({"kind": kind}))
            .send()
            .expect("create_agent")
            .json()
            .expect("parse json")
    }

    fn get_agent(&self, agent_id: &str) -> serde_json::Value {
        self.client()
            .get(self.url(&format!("/v1/agents/{agent_id}")))
            .send()
            .expect("get_agent")
            .json()
            .expect("parse json")
    }

    fn wait_agent_running(&self, agent_id: &str, timeout: Duration) -> serde_json::Value {
        let deadline = Instant::now() + timeout;
        loop {
            let a = self.get_agent(agent_id);
            match a["status"].as_str() {
                Some("running") => return a,
                Some("failed") => {
                    let log_path = self
                        .state_dir
                        .join("agents")
                        .join(agent_id)
                        .join("agent.log");
                    let log = std::fs::read_to_string(&log_path).unwrap_or_else(|e| {
                        format!("(could not read {}: {e})", log_path.display())
                    });
                    panic!(
                        "agent {agent_id} failed: {a}\n--- agent.log ---\n{log}\n--- end ---"
                    );
                }
                _ => {}
            }
            if Instant::now() > deadline {
                panic!(
                    "agent {agent_id} did not reach running within {:?}; last: {a}",
                    timeout
                );
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    }

    fn wait_running(&self, id: &str, timeout: Duration) -> serde_json::Value {
        let deadline = Instant::now() + timeout;
        loop {
            let vm: serde_json::Value = self
                .client()
                .get(self.url(&format!("/v1/vms/{id}")))
                .send()
                .expect("get vm")
                .json()
                .expect("parse vm");
            match vm["status"].as_str() {
                Some("running") => return vm,
                Some("failed") => panic!("vm {id} entered failed state: {vm}"),
                _ => {}
            }
            if Instant::now() > deadline {
                panic!(
                    "vm {id} did not reach running within {:?}; last state: {vm}",
                    timeout
                );
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    }

    fn ssh_info(&self, id: &str) -> serde_json::Value {
        self.client()
            .get(self.url(&format!("/v1/vms/{id}/ssh")))
            .send()
            .expect("ssh info")
            .json()
            .expect("parse ssh")
    }

    fn stop_vm(&self, id: &str) {
        let _ = self
            .client()
            .post(self.url(&format!("/v1/vms/{id}/stop")))
            .send();
    }
}

impl Drop for FullHarness {
    fn drop(&mut self) {
        // Stop everything to avoid leaking QEMUs across tests.
        if let Ok(resp) = self.client().get(self.url("/v1/vms")).send() {
            if let Ok(list) = resp.json::<Vec<serde_json::Value>>() {
                for agent in list {
                    if let Some(id) = agent.get("id").and_then(|v| v.as_str()) {
                        let _ = self
                            .client()
                            .post(self.url(&format!("/v1/vms/{id}/stop")))
                            .send();
                    }
                }
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
        // Belt-and-suspenders: reap any QEMU still tied to our state dir.
        let state_str = self.state_dir.to_string_lossy().to_string();
        if let Ok(out) = Command::new("pgrep").arg("-af").arg(&state_str).output() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                if line.contains("qemu-system-x86_64") {
                    if let Some(pid) = line.split_whitespace().next() {
                        let _ = Command::new("kill").arg(pid).status();
                    }
                }
            }
        }
    }
}

fn next_port() -> u16 {
    use std::sync::atomic::{AtomicU16, Ordering};
    static SEED: AtomicU16 = AtomicU16::new(28878);
    SEED.fetch_add(1, Ordering::SeqCst)
}

/// Materialise the supervisor's per-host SSH keypair to a temp file with
/// 0600, return its path. The supervisor exposes the *private* key the host
/// uses to authenticate as `root` inside the guest; we use it the same way
/// `mows tools agent attach` does.
fn write_ssh_key(info: &serde_json::Value) -> PathBuf {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("id_ed25519");
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(&path)
        .expect("create key");
    f.write_all(info["private_key"].as_str().unwrap().as_bytes())
        .expect("write key");
    // We deliberately leak the tempdir so the caller can use the key —
    // forget the guard but keep the path.
    let path = path.clone();
    std::mem::forget(dir);
    path
}

fn ssh_run(host: &str, port: i64, key: &PathBuf, cmd: &str) -> std::process::Output {
    let known_hosts = std::env::temp_dir().join(format!(
        "mows-e2e-known-hosts-{}-{}",
        std::process::id(),
        port,
    ));
    let _ = std::fs::remove_file(&known_hosts);
    Command::new("ssh")
        .arg("-i")
        .arg(key)
        .arg("-p")
        .arg(port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", known_hosts.display()))
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg(format!("root@{host}"))
        .arg(cmd)
        .stdin(Stdio::null())
        .output()
        .expect("ssh exec")
}

/// Boot a `shell` VM end-to-end and run `echo hello` over SSH.
///
/// Catches:
/// - missing kernel/initramfs/qcow2 wiring
/// - mows-agent-init not running (no authorized_keys, no `cd /workspace`)
/// - sshd not listening on guest:22
/// - 9p init share not propagating the supervisor's pubkey
#[test]
#[ignore = "requires KVM + built guest image; run with --ignored"]
fn shell_vm_boots_and_executes_remote_command() {
    let h = FullHarness::start(next_port());
    let created = h.create_vm();
    let id = created["id"].as_str().unwrap().to_string();
    let _running = h.wait_running(&id, Duration::from_secs(120));
    let info = h.ssh_info(&id);
    let key = write_ssh_key(&info);

    let out = ssh_run(
        info["host"].as_str().unwrap(),
        info["port"].as_i64().unwrap(),
        &key,
        "echo hello-from-vm",
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        out.status.success(),
        "ssh exec failed: status={:?} stdout={stdout} stderr={stderr}",
        out.status,
    );
    assert!(
        stdout.contains("hello-from-vm"),
        "expected echo output in stdout, got: {stdout}",
    );
    h.stop_vm(&id);
}

/// Two VMs in succession. Forces the supervisor's port allocator to either
/// hand out distinct ports OR (under range pressure) recycle a port — and
/// in both cases the guest's regenerated host SSH keypair must not pollute
/// a known_hosts file. This is the test class that would have caught the
/// `mows-agent-known-hosts-<port>` collision bug.
#[test]
#[ignore = "requires KVM + built guest image; run with --ignored"]
fn two_consecutive_vms_attach_cleanly() {
    let h = FullHarness::start(next_port());

    for label in ["first", "second"] {
        let created = h.create_vm();
        let id = created["id"].as_str().unwrap().to_string();
        h.wait_running(&id, Duration::from_secs(120));
        let info = h.ssh_info(&id);
        let key = write_ssh_key(&info);
        let out = ssh_run(
            info["host"].as_str().unwrap(),
            info["port"].as_i64().unwrap(),
            &key,
            &format!("echo {label}"),
        );
        assert!(
            out.status.success(),
            "ssh on {label} VM ({id}) failed: stderr={}",
            String::from_utf8_lossy(&out.stderr),
        );
        let stdout = String::from_utf8_lossy(&out.stdout);
        assert!(stdout.contains(label), "{label}: bad stdout: {stdout}");
        h.stop_vm(&id);
        // Briefly let the port allocator move on / kernel reclaim the port.
        std::thread::sleep(Duration::from_millis(500));
    }
}

/// Console pipeline end-to-end:
///  1. The chardev `logfile=` captured boot output to `console.log` on disk
///     (Linux kernel banner reliably contains "Linux version").
///  2. The websocket proxy replays that scrollback to clients on connect.
///
/// Live-tail on a fully booted shell VM is silent (no getty on ttyS0), so
/// we verify the replay path which is what makes the web console useful
/// for debugging boot/runtime state. (1) covers the QEMU side, (2) covers
/// the supervisor side; together they prove the pipeline works.
#[test]
#[ignore = "requires KVM + built guest image; run with --ignored"]
fn console_websocket_replays_real_boot_output() {
    use futures_util::StreamExt;
    use tokio_tungstenite::tungstenite::Message;

    let h = FullHarness::start(next_port());
    let created = h.create_vm();
    let id = created["id"].as_str().unwrap().to_string();
    h.wait_running(&id, Duration::from_secs(120));

    // (1) On-disk log captured boot output via QEMU chardev `logfile=`.
    //     Per-VM dirs live under `<state_dir>/vms/<vm_id>/` (post-refactor;
    //     was `agents/<id>/` when VMs and agents were the same row).
    let log_path = h
        .state_dir
        .join("vms")
        .join(&id)
        .join("console.log");
    let log = std::fs::read(&log_path).expect("console.log must exist after boot");
    assert!(
        !log.is_empty(),
        "console.log at {} is empty — chardev logfile= not capturing",
        log_path.display(),
    );
    let log_str = String::from_utf8_lossy(&log);
    assert!(
        log_str.contains("Linux version") || log_str.contains("Alpine"),
        "console.log does not look like a Linux boot log; first 200B: {:?}",
        &log_str[..log_str.len().min(200)],
    );

    // (2) Websocket replay: the proxy must send the persisted log as the
    // first frame to a fresh client.
    let ws_url = h.base_url.replacen("http://", "ws://", 1)
        + &format!("/v1/vms/{id}/console");
    let replay = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            let (mut ws, _) = tokio_tungstenite::connect_async(&ws_url)
                .await
                .expect("ws connect");
            // First frame should be the scrollback replay.
            tokio::time::timeout(Duration::from_secs(5), ws.next())
                .await
                .expect("first frame timeout")
                .expect("ws stream ended")
                .expect("ws error")
        });
    let bytes: Vec<u8> = match replay {
        Message::Binary(b) => b.to_vec(),
        Message::Text(t) => t.as_bytes().to_vec(),
        other => panic!("expected scrollback frame, got {other:?}"),
    };
    let replay_str = String::from_utf8_lossy(&bytes);
    assert!(
        replay_str.contains("Linux version") || replay_str.contains("Alpine"),
        "websocket replay missing boot text; first 200B: {:?}",
        &replay_str[..replay_str.len().min(200)],
    );
    h.stop_vm(&id);
}

/// End-to-end claude run: boot a VM, spawn an agent of kind=claude, and
/// verify the runtime flips to `running` (which only happens after the
/// supervisor sees a real stdout byte from claude — i.e. the binary
/// launched, found its credentials, and printed *something*).
///
/// Then read the persisted `agent.log` and assert it contains a
/// recognizable claude marker. The exact banner text shifts between
/// claude-code releases, so we accept any of several known substrings;
/// failure of all of them likely means claude bailed out before printing.
///
/// Requires `~/.claude` (or wherever `MOWS_AGENT_HOST_CREDS_PATH` points)
/// to contain valid claude-code credentials. The harness panics with a
/// clear message if the directory is empty or missing — we want explicit
/// failure here, not silent skip.
#[test]
#[ignore = "requires KVM + built guest image + claude credentials; run with --ignored"]
fn claude_agent_starts_and_prints_banner() {
    require_claude_creds();

    let h = FullHarness::start(next_port());
    let vm = h.create_vm();
    let vm_id = vm["id"].as_str().unwrap().to_string();
    h.wait_running(&vm_id, Duration::from_secs(180));

    let agent = h.create_agent(&vm_id, "claude");
    let agent_id = agent["id"].as_str().unwrap().to_string();
    assert_eq!(agent["kind"].as_str(), Some("claude"));
    assert_eq!(agent["vm_id"].as_str(), Some(vm_id.as_str()));
    assert_eq!(agent["status"].as_str(), Some("starting"));

    // The runtime sets status=running on the FIRST byte of stdout. Claude
    // prints its banner immediately, so 60 s is generous.
    let _running = h.wait_agent_running(&agent_id, Duration::from_secs(60));

    // Drain the persisted agent.log (lives on the supervisor side).
    let log_path = h
        .state_dir
        .join("agents")
        .join(&agent_id)
        .join("agent.log");
    // The supervisor writes the log; it may take a beat to flush before we
    // read it directly off disk. A short wait avoids racing.
    std::thread::sleep(Duration::from_millis(500));
    let log = std::fs::read_to_string(&log_path)
        .unwrap_or_else(|e| panic!("failed to read agent log {}: {e}", log_path.display()));

    // Accept any of these markers — all are claude-code-specific; the exact
    // banner text is version-dependent. (Plain `claude` would also match a
    // bash error like "claude: not found" in stderr, but we send stderr to
    // its own file via the runtime, not agent.log.)
    let markers = ["Welcome", "Claude Code", "claude.ai", "Anthropic", "anthropic"];
    let hit = markers.iter().any(|m| log.contains(m));
    assert!(
        hit,
        "agent.log does not look like claude output. \
         Tried markers {markers:?}; log first 400B: {:?}",
        &log[..log.len().min(400)],
    );

    h.stop_vm(&vm_id);
}

/// Synthesize a creds dir that mirrors a host where claude truncated its
/// active config: `.claude.json` exists but is **empty**, while a populated
/// backup is in `backups/`. Returns (creds_dir, valid_backup_path).
///
/// Reproduces the exact regression the user hit: the bootstrap's "if
/// missing, restore from backup" branch passes the existence check and
/// hands claude a 0-byte file, so claude crashes with `Unexpected EOF`.
fn synth_corrupt_creds(real_creds: &Path) -> (tempfile::TempDir, PathBuf) {
    let valid_json_source = real_creds.join(".claude.json");
    let valid_bytes = if valid_json_source.exists() && std::fs::metadata(&valid_json_source).map(|m| m.len()).unwrap_or(0) > 0 {
        std::fs::read(&valid_json_source).expect("read host .claude.json")
    } else {
        // Synthesize a minimal valid claude config: claude only requires a
        // parseable JSON object with a few well-known keys. We don't need a
        // full live config to prove the restore branch fires — claude
        // accepting non-empty JSON is sufficient to reach a stdout byte
        // (which is what flips the agent to "running").
        b"{\"oauthAccount\":{}}\n".to_vec()
    };

    let synth = tempfile::tempdir().expect("synth creds tempdir");
    std::fs::create_dir_all(synth.path().join("backups")).unwrap();
    // Empty active config (the broken state).
    std::fs::write(synth.path().join(".claude.json"), b"").unwrap();
    let backup = synth
        .path()
        .join(format!("backups/.claude.json.backup.{}", chrono::Utc::now().timestamp_millis()));
    std::fs::write(&backup, &valid_bytes).unwrap();
    (synth, backup)
}

/// Stuff a synthetic creds dir with the kinds of crud that shows up in a
/// long-lived host `~/.claude`: a symlink loop and a multi-MB stray file
/// alongside the auth dir. The bootstrap MUST be selective and not
/// blanket-copy the tree (that would either fill the VM disk or abort on
/// the symlink loop, in both cases leaving the agent unauthenticated).
fn add_realistic_clutter(creds: &Path) {
    use std::os::unix::fs::symlink;
    let debug_dir = creds.join("debug");
    let _ = std::fs::create_dir_all(&debug_dir);
    // Self-pointing symlink — same shape as the one we found in the user's
    // host. cp -a chokes on this with "Symbolic link loop".
    let _ = symlink(".", debug_dir.join("latest"));
    // Stray multi-MB file in a sibling dir. Doesn't have to be huge to
    // demonstrate the principle; the assertion is "bootstrap doesn't try
    // to copy this".
    let big = creds.join("file-history");
    let _ = std::fs::create_dir_all(&big);
    let _ = std::fs::write(big.join("blob.bin"), vec![0u8; 4 * 1024 * 1024]);
}

/// Empty `.claude.json` with a valid backup must auto-restore so the agent
/// reaches `running`. Catches the user-reported "Unexpected EOF" failure
/// AND the failure mode where the bootstrap's blanket cp gets aborted by
/// host-side clutter (symlink loops, huge cache dirs) before reaching
/// `backups/`.
#[test]
#[ignore = "requires KVM + built guest image + claude credentials; run with --ignored"]
fn claude_recovers_when_active_config_is_empty() {
    require_claude_creds();
    // We need a non-empty source for the synthetic backup. Pull bytes from
    // the host's real `.claude.json` if it has any; otherwise synthesize a
    // minimal valid stub.
    let real_creds = std::env::var("MOWS_AGENT_HOST_CREDS_PATH")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").expect("HOME");
            PathBuf::from(home).join(".claude")
        });
    let (creds_dir, _backup) = synth_corrupt_creds(&real_creds);
    add_realistic_clutter(creds_dir.path());

    let h = FullHarness::start_with_creds(next_port(), Some(creds_dir.path().to_path_buf()));
    let vm = h.create_vm();
    let vm_id = vm["id"].as_str().unwrap().to_string();
    h.wait_running(&vm_id, Duration::from_secs(180));

    let agent = h.create_agent(&vm_id, "claude");
    let agent_id = agent["id"].as_str().unwrap().to_string();

    // If the auto-restore branch worked, claude accepts the (restored)
    // config and prints something — the runtime sees a stdout byte and
    // flips the agent to running. If it didn't, claude exits with
    // `Unexpected EOF` and we hit `failed` (the panic dumps agent.log).
    h.wait_agent_running(&agent_id, Duration::from_secs(60));

    h.stop_vm(&vm_id);
}

fn require_claude_creds() {
    // The supervisor forwards the host's claude dir as `/host-creds` (env
    // override `MOWS_AGENT_HOST_CREDS_PATH`). Our test process runs on the
    // host, so we check the host path directly.
    let host_creds_env = std::env::var("MOWS_AGENT_HOST_CREDS_PATH").ok().map(PathBuf::from);
    let host_creds = host_creds_env.unwrap_or_else(|| {
        let home = std::env::var("HOME").expect("HOME must be set");
        PathBuf::from(home).join(".claude")
    });
    assert!(
        host_creds.exists(),
        "claude credentials directory missing at {} — log into claude on the host \
         (or set MOWS_AGENT_HOST_CREDS_PATH) before running this test",
        host_creds.display(),
    );
    let entries = std::fs::read_dir(&host_creds)
        .map(|it| it.count())
        .unwrap_or(0);
    assert!(
        entries > 0,
        "claude credentials directory at {} is empty — log into claude first",
        host_creds.display(),
    );
}
