//! Long-lived ssh-backed terminal sessions.
//!
//! The supervisor owns one `VmSshSession` per `(vm_id, session_id)` tuple
//! the client supplies. The lifetime of that session is decoupled from
//! the websocket: when the browser closes the WS (page reload, tab
//! close, network blip) the underlying `ssh` subprocess + its remote
//! pty keep running. A subsequent connection with the same `session_id`
//! reattaches to the live process, replays the most recent output from
//! a ring buffer so xterm.js re-paints the current screen state, and
//! continues piping bytes both ways.
//!
//! This replaces an earlier guest-side tmux wrapper. tmux's
//! status-bar / escape-mediation interfered with claude-code's TUI;
//! owning the multiplexing here means the guest sees a plain ssh
//! session and the client sees the same byte stream both old and new.
//!
//! Lifetime — a session ends when:
//! 1. The supervisor calls `VmSshSessionRegistry::shutdown_vm` (e.g.
//!    the VM is deleted) — cancels and kills the ssh child.
//! 2. The remote ssh child exits on its own (user typed `exit`, the
//!    inner command crashed) — the I/O loop notices EOF and removes
//!    the registry entry.
//!
//! The registry is intentionally lightweight: a `parking_lot::Mutex`
//! around `HashMap<SessionKey, Arc<VmSshSession>>`. Per-session state
//! lives behind `Arc` so attach/detach is just clone + drop.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::sync::broadcast;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

/// Maximum bytes retained per session for replay. ~256 KiB covers a
/// full TUI re-render (claude-code's full screen is well under 64 KiB)
/// plus a chunk of scrollback on the client's first paint.
const REPLAY_BUFFER_BYTES: usize = 256 * 1024;

/// Maximum bytes per pty read. xterm pipes large pastes through, so
/// reads can be sizeable; keep this in step with the WS frame limit
/// on the consumer side (`WS_PROXY_CHUNK_BYTES` in `api/vms.rs`).
const PTY_READ_CHUNK_BYTES: usize = 32 * 1024;

/// Channel capacity for output fanout. One slot per pending chunk; if
/// a slow client falls this far behind it gets dropped on the next
/// send and reconnects from the replay buffer.
const OUTPUT_CHANNEL_CAPACITY: usize = 64;

/// Channel capacity for input. Browser bytes are typically tiny
/// (keystrokes); a small buffer is fine.
const INPUT_CHANNEL_CAPACITY: usize = 64;

/// Composite key — same `session_id` against different VMs must not
/// collide.
#[derive(Clone, Hash, PartialEq, Eq, Debug)]
struct SessionKey {
    vm_id: String,
    session_id: String,
}

#[derive(Default)]
pub struct VmSshSessionRegistry {
    inner: Mutex<HashMap<SessionKey, Arc<VmSshSession>>>,
}

#[derive(Debug)]
pub struct VmSshSession {
    /// Send bytes to the ssh subprocess's stdin.
    input_tx: mpsc::Sender<Vec<u8>>,
    /// New attachers subscribe here for live output.
    output_tx: broadcast::Sender<Vec<u8>>,
    /// Most recent output bytes, replayed on every reattach so xterm
    /// re-paints the current screen state.
    replay_buffer: Mutex<RingBuffer>,
    /// Killed by the registry on `shutdown_vm` or when the ssh child exits.
    cancel: CancellationToken,
}

impl VmSshSessionRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Look up an existing session for `(vm_id, session_id)`, or
    /// `None` when no such session is registered.
    pub fn get(&self, vm_id: &str, session_id: &str) -> Option<Arc<VmSshSession>> {
        let key = SessionKey {
            vm_id: vm_id.to_owned(),
            session_id: session_id.to_owned(),
        };
        self.inner.lock().get(&key).cloned()
    }

    /// Install a freshly-spawned session. Returns `Err` if a session
    /// with the same key already exists (race between concurrent
    /// attachers) — the caller should drop its session and use the
    /// existing one instead.
    pub fn insert(
        &self,
        vm_id: String,
        session_id: String,
        session: Arc<VmSshSession>,
    ) -> Result<(), Arc<VmSshSession>> {
        let key = SessionKey { vm_id, session_id };
        let mut guard = self.inner.lock();
        if let Some(existing) = guard.get(&key) {
            return Err(existing.clone());
        }
        guard.insert(key, session);
        Ok(())
    }

    /// Remove a session entry. Called from the I/O loop when the ssh
    /// child exits cleanly so the next attach starts a fresh process.
    pub fn remove(&self, vm_id: &str, session_id: &str) {
        let key = SessionKey {
            vm_id: vm_id.to_owned(),
            session_id: session_id.to_owned(),
        };
        self.inner.lock().remove(&key);
    }

    /// Kill every session for `vm_id`. Invoked when the VM is being
    /// deleted so we never leak ssh subprocesses against a guest
    /// that no longer exists.
    pub fn shutdown_vm(&self, vm_id: &str) {
        let mut guard = self.inner.lock();
        let mut to_drop = Vec::new();
        guard.retain(|key, session| {
            if key.vm_id == vm_id {
                session.cancel.cancel();
                to_drop.push(session.clone());
                false
            } else {
                true
            }
        });
        drop(guard);
        // Release the locked map before the Arc drops fire any side
        // effects (the I/O loops poll the cancel token and exit, then
        // drop their channels — none of that needs the registry lock).
        drop(to_drop);
    }
}

impl VmSshSession {
    /// Send a single chunk of input to the ssh subprocess. Returns
    /// `false` when the input channel has closed (the ssh process
    /// died or the session was cancelled).
    pub async fn send_input(&self, bytes: Vec<u8>) -> bool {
        self.input_tx.send(bytes).await.is_ok()
    }

    /// Subscribe to live output. Each subscriber gets every chunk
    /// from the call site onward; replay of historical state goes
    /// through `replay_snapshot`.
    pub fn subscribe(&self) -> broadcast::Receiver<Vec<u8>> {
        self.output_tx.subscribe()
    }

    /// Copy of the replay buffer for the new attacher's first paint.
    pub fn replay_snapshot(&self) -> Vec<u8> {
        self.replay_buffer.lock().snapshot()
    }
}

/// Spec captured from the request that wants to spawn a fresh session.
/// The registry uses these to construct the actual `ssh` command.
pub struct SpawnSshSessionSpec {
    pub vm_id: String,
    pub session_id: String,
    pub priv_key: PathBuf,
    pub port: u16,
    pub ssh_target: String,
    pub known_hosts: PathBuf,
    pub remote_command: String,
    pub cols: u16,
    pub rows: u16,
}

/// Spawn the ssh subprocess for a new session and wire its I/O into
/// the channels of a returned `VmSshSession`. The registry is
/// responsible for inserting/removing the session from its map.
pub fn spawn_session(
    spec: SpawnSshSessionSpec,
    registry: Arc<VmSshSessionRegistry>,
) -> std::io::Result<Arc<VmSshSession>> {
    use std::process::Stdio;

    let mut child = Command::new("ssh")
        .arg("-tt")
        .arg("-i")
        .arg(&spec.priv_key)
        .arg("-p")
        .arg(spec.port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", spec.known_hosts.display()))
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg("-o")
        .arg("ServerAliveInterval=15")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-o")
        .arg("SendEnv=COLUMNS LINES TERM COLORTERM")
        .arg(&spec.ssh_target)
        .arg(&spec.remote_command)
        .env("COLUMNS", spec.cols.to_string())
        .env("LINES", spec.rows.to_string())
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;

    let mut child_stdin = child.stdin.take().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::BrokenPipe, "ssh stdin missing")
    })?;
    let mut child_stdout = child.stdout.take().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::BrokenPipe, "ssh stdout missing")
    })?;
    let mut child_stderr = child.stderr.take().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::BrokenPipe, "ssh stderr missing")
    })?;

    let (input_tx, mut input_rx) = mpsc::channel::<Vec<u8>>(INPUT_CHANNEL_CAPACITY);
    let (output_tx, _) = broadcast::channel::<Vec<u8>>(OUTPUT_CHANNEL_CAPACITY);
    let replay_buffer = Mutex::new(RingBuffer::with_capacity(REPLAY_BUFFER_BYTES));
    let cancel = CancellationToken::new();

    let session = Arc::new(VmSshSession {
        input_tx,
        output_tx: output_tx.clone(),
        replay_buffer,
        cancel: cancel.clone(),
    });

    // Pump websocket-side input → ssh stdin.
    let cancel_input = cancel.clone();
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = cancel_input.cancelled() => break,
                next = input_rx.recv() => {
                    let Some(bytes) = next else { break };
                    if child_stdin.write_all(&bytes).await.is_err() {
                        break;
                    }
                }
            }
        }
        let _ = child_stdin.shutdown().await;
    });

    // Pump ssh stdout → output broadcast + replay buffer.
    let session_for_output = session.clone();
    let cancel_output = cancel.clone();
    let registry_for_output = registry.clone();
    let vm_id_for_output = spec.vm_id.clone();
    let session_id_for_output = spec.session_id.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; PTY_READ_CHUNK_BYTES];
        loop {
            tokio::select! {
                _ = cancel_output.cancelled() => break,
                read = child_stdout.read(&mut buf) => {
                    match read {
                        Ok(0) => break,
                        Ok(n) => {
                            let chunk = buf[..n].to_vec();
                            session_for_output.replay_buffer.lock().push(&chunk);
                            // Broadcast send fails only when nobody
                            // is subscribed — that's expected when no
                            // browser is attached; the buffer still
                            // captures the bytes for the next attach.
                            let _ = session_for_output.output_tx.send(chunk);
                        }
                        Err(_) => break,
                    }
                }
            }
        }
        // EOF or cancel: drop the session so the next attach starts
        // a fresh ssh subprocess instead of returning a corpse.
        cancel_output.cancel();
        registry_for_output.remove(&vm_id_for_output, &session_id_for_output);
    });

    // Drain stderr to keep the pipe from filling up. Surface a single
    // info-level log entry per session for operator visibility.
    let vm_id_for_stderr = spec.vm_id.clone();
    let session_id_for_stderr = spec.session_id.clone();
    tokio::spawn(async move {
        let mut acc = Vec::with_capacity(4096);
        let mut buf = [0u8; 1024];
        loop {
            match child_stderr.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => acc.extend_from_slice(&buf[..n]),
            }
            if acc.len() > 16_384 {
                break;
            }
        }
        if !acc.is_empty() {
            tracing::debug!(
                vm_id = %vm_id_for_stderr,
                session_id = %session_id_for_stderr,
                stderr = %String::from_utf8_lossy(&acc),
                "ssh session stderr"
            );
        }
    });

    // Surface child exit at info level + ensure the registry entry
    // disappears once the process is gone. Runs independently of the
    // stdout pump in case the child exits without closing stdout (rare).
    let cancel_wait = cancel.clone();
    let registry_for_wait = registry.clone();
    let vm_id_for_wait = spec.vm_id.clone();
    let session_id_for_wait = spec.session_id.clone();
    tokio::spawn(async move {
        let exit = tokio::select! {
            _ = cancel_wait.cancelled() => None,
            status = child.wait() => Some(status),
        };
        match exit {
            Some(Ok(status)) => tracing::info!(
                vm_id = %vm_id_for_wait,
                session_id = %session_id_for_wait,
                exit = ?status,
                "ssh session exited"
            ),
            Some(Err(e)) => tracing::warn!(
                vm_id = %vm_id_for_wait,
                session_id = %session_id_for_wait,
                error = %e,
                "ssh session wait failed"
            ),
            None => {
                let _ = child.kill().await;
            }
        }
        cancel_wait.cancel();
        registry_for_wait.remove(&vm_id_for_wait, &session_id_for_wait);
    });

    Ok(session)
}

/// Fixed-size byte ring buffer used to replay recent output to
/// reattaching clients. Always keeps the most-recent bytes; the
/// `snapshot` returns them in linear order ready to write to a fresh
/// xterm buffer.
#[derive(Debug)]
struct RingBuffer {
    data: Vec<u8>,
    capacity: usize,
}

impl RingBuffer {
    fn with_capacity(capacity: usize) -> Self {
        Self {
            data: Vec::with_capacity(capacity),
            capacity,
        }
    }

    fn push(&mut self, chunk: &[u8]) {
        if chunk.len() >= self.capacity {
            // Single chunk overflows the buffer — keep only the tail.
            let start = chunk.len() - self.capacity;
            self.data.clear();
            self.data.extend_from_slice(&chunk[start..]);
            return;
        }
        let new_len = self.data.len() + chunk.len();
        if new_len > self.capacity {
            let drop = new_len - self.capacity;
            self.data.drain(0..drop);
        }
        self.data.extend_from_slice(chunk);
    }

    fn snapshot(&self) -> Vec<u8> {
        self.data.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_buffer_keeps_tail_when_overflowing() {
        let mut rb = RingBuffer::with_capacity(10);
        rb.push(b"abcdef"); // 6 bytes
        rb.push(b"ghijkl"); // total would be 12 → drop 2 oldest
        assert_eq!(rb.snapshot(), b"cdefghijkl");
    }

    #[test]
    fn ring_buffer_handles_single_chunk_larger_than_capacity() {
        let mut rb = RingBuffer::with_capacity(4);
        rb.push(b"abcdefghij");
        // Keep last 4 bytes only.
        assert_eq!(rb.snapshot(), b"ghij");
    }

    #[test]
    fn registry_insert_then_remove_round_trip() {
        let registry = VmSshSessionRegistry::new();
        let session = Arc::new(VmSshSession {
            input_tx: mpsc::channel(1).0,
            output_tx: broadcast::channel(1).0,
            replay_buffer: Mutex::new(RingBuffer::with_capacity(8)),
            cancel: CancellationToken::new(),
        });
        registry
            .insert("vm".into(), "tab".into(), session.clone())
            .expect("first insert succeeds");
        assert!(registry.get("vm", "tab").is_some());
        assert!(registry.get("vm", "other").is_none());
        registry.remove("vm", "tab");
        assert!(registry.get("vm", "tab").is_none());
    }

    #[test]
    fn registry_insert_collision_returns_existing() {
        let registry = VmSshSessionRegistry::new();
        let s1 = Arc::new(VmSshSession {
            input_tx: mpsc::channel(1).0,
            output_tx: broadcast::channel(1).0,
            replay_buffer: Mutex::new(RingBuffer::with_capacity(8)),
            cancel: CancellationToken::new(),
        });
        let s2 = Arc::new(VmSshSession {
            input_tx: mpsc::channel(1).0,
            output_tx: broadcast::channel(1).0,
            replay_buffer: Mutex::new(RingBuffer::with_capacity(8)),
            cancel: CancellationToken::new(),
        });
        registry
            .insert("vm".into(), "tab".into(), s1.clone())
            .expect("first insert succeeds");
        let collision = registry
            .insert("vm".into(), "tab".into(), s2)
            .expect_err("collision returns existing");
        assert!(Arc::ptr_eq(&collision, &s1));
    }

    #[test]
    fn shutdown_vm_cancels_only_matching_sessions() {
        let registry = VmSshSessionRegistry::new();
        let keep = Arc::new(VmSshSession {
            input_tx: mpsc::channel(1).0,
            output_tx: broadcast::channel(1).0,
            replay_buffer: Mutex::new(RingBuffer::with_capacity(8)),
            cancel: CancellationToken::new(),
        });
        let drop_me = Arc::new(VmSshSession {
            input_tx: mpsc::channel(1).0,
            output_tx: broadcast::channel(1).0,
            replay_buffer: Mutex::new(RingBuffer::with_capacity(8)),
            cancel: CancellationToken::new(),
        });
        registry
            .insert("vm-keep".into(), "t".into(), keep.clone())
            .unwrap();
        registry
            .insert("vm-drop".into(), "t".into(), drop_me.clone())
            .unwrap();

        registry.shutdown_vm("vm-drop");

        assert!(registry.get("vm-drop", "t").is_none());
        assert!(drop_me.cancel.is_cancelled());
        assert!(registry.get("vm-keep", "t").is_some());
        assert!(!keep.cancel.is_cancelled());
    }
}
