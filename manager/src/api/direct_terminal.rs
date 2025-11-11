/*
New Terminal Implementation with Proper Flow Control for xterm.js

Key improvements:
- Proper flow control with ACK mechanism for backpressure handling
- No artificial delays in the data path
- Watermark-based buffering strategy
- Clean separation of concerns
- Better error handling and recovery
- Proper PTY signal handling

References:
- xterm.js Flow Control: https://xtermjs.org/docs/guides/flowcontrol/
- PTY best practices for web terminals
*/

use axum::{
    extract::{
        ws::{close_code, CloseFrame, Message, WebSocket, WebSocketUpgrade},
        Path,
    },
    response::IntoResponse,
};
use bytes::Bytes;
use futures_util::{
    stream::{SplitSink, SplitStream},
    SinkExt, StreamExt,
};
use pty_process::{OwnedWritePty, Pty, Size};
use std::{
    io::Write,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};
use tempfile::NamedTempFile;
use tokio::{
    io::AsyncWriteExt,
    sync::{mpsc, Mutex, Notify},
};
use tracing::{debug, error, info, trace, warn};

use crate::get_current_config_cloned;

// Flow control constants based on xterm.js recommendations
const HIGH_WATERMARK: usize = 500_000; // 500KB - pause sending above this
const LOW_WATERMARK: usize = 100_000; // 100KB - resume sending below this
// Note: ACK_THRESHOLD is defined in frontend (100KB)
const PTY_BUFFER_SIZE: usize = 8192; // 8KB PTY read buffer

/// Message types for terminal communication protocol
#[derive(Debug, Clone)]
enum TerminalMessage {
    /// Initialize terminal with size (rows, cols)
    Start(u16, u16),
    /// User input data to PTY
    Input(Vec<u8>),
    /// Resize terminal to new dimensions (rows, cols)
    Resize(u16, u16),
    /// Client acknowledgment of processed bytes
    Ack(usize),
    /// Keep-alive ping
    Ping,
    /// Client closing connection
    Close,
}

/// Parse incoming WebSocket messages into TerminalMessage
impl TerminalMessage {
    fn parse(msg: Message) -> Option<Self> {
        match msg {
            Message::Text(text) => Self::parse_text(&text),
            Message::Binary(data) => Self::parse_binary(&data),
            Message::Ping(_) => Some(TerminalMessage::Ping),
            Message::Close(_) => Some(TerminalMessage::Close),
            _ => None,
        }
    }

    fn parse_text(text: &str) -> Option<Self> {
        let parts: Vec<&str> = text.split(';').collect();

        if parts.is_empty() {
            return Some(TerminalMessage::Input(text.as_bytes().to_vec()));
        }

        match parts[0] {
            "0" => {
                // Start message: "0;rows;cols"
                if parts.len() >= 3 {
                    let rows = parts[1].parse::<u16>().ok()?;
                    let cols = parts[2].parse::<u16>().ok()?;
                    Some(TerminalMessage::Start(rows, cols))
                } else {
                    warn!("Invalid start message format: {}", text);
                    None
                }
            }
            "1" => {
                // Input message: "1;data"
                if parts.len() >= 2 {
                    Some(TerminalMessage::Input(text[2..].as_bytes().to_vec()))
                } else {
                    Some(TerminalMessage::Input(Vec::new()))
                }
            }
            "2" => {
                // Resize message: "2;rows;cols"
                if parts.len() >= 3 {
                    let rows = parts[1].parse::<u16>().ok()?;
                    let cols = parts[2].parse::<u16>().ok()?;
                    Some(TerminalMessage::Resize(rows, cols))
                } else {
                    warn!("Invalid resize message format: {}", text);
                    None
                }
            }
            "3" => {
                // ACK message: "3;bytes_processed"
                if parts.len() >= 2 {
                    let bytes = parts[1].parse::<usize>().ok()?;
                    Some(TerminalMessage::Ack(bytes))
                } else {
                    None
                }
            }
            _ => {
                // Unknown prefix, treat as input
                Some(TerminalMessage::Input(text.as_bytes().to_vec()))
            }
        }
    }

    fn parse_binary(data: &[u8]) -> Option<Self> {
        if data.len() < 2 {
            return Some(TerminalMessage::Input(data.to_vec()));
        }

        // Check for "1;" prefix in binary data
        if data[0] == b'1' && data[1] == b';' {
            Some(TerminalMessage::Input(data[2..].to_vec()))
        } else {
            Some(TerminalMessage::Input(data.to_vec()))
        }
    }
}

/// Flow control state for managing backpressure
struct FlowControl {
    /// Bytes sent but not yet acknowledged
    pending_bytes: AtomicU64,
    /// Whether sending is currently paused
    paused: AtomicBool,
    /// Notify when flow control state changes
    resume_notify: Notify,
}

impl FlowControl {
    fn new() -> Self {
        Self {
            pending_bytes: AtomicU64::new(0),
            paused: AtomicBool::new(false),
            resume_notify: Notify::new(),
        }
    }

    /// Record bytes sent to client
    fn bytes_sent(&self, count: usize) -> bool {
        let new_pending = self.pending_bytes.fetch_add(count as u64, Ordering::Relaxed) + count as u64;

        if new_pending >= HIGH_WATERMARK as u64 && !self.paused.load(Ordering::Relaxed) {
            debug!("Flow control: pausing at {} bytes pending", new_pending);
            self.paused.store(true, Ordering::Relaxed);
            return true;
        }

        false
    }

    /// Record ACK from client
    fn bytes_acknowledged(&self, count: usize) {
        let old_pending = self.pending_bytes.fetch_sub(count as u64, Ordering::Relaxed);
        let new_pending = old_pending.saturating_sub(count as u64);

        if new_pending <= LOW_WATERMARK as u64 && self.paused.load(Ordering::Relaxed) {
            debug!("Flow control: resuming at {} bytes pending", new_pending);
            self.paused.store(false, Ordering::Relaxed);
            self.resume_notify.notify_waiters();
        }
    }

    /// Wait until flow control allows sending
    async fn wait_if_paused(&self) {
        while self.paused.load(Ordering::Relaxed) {
            self.resume_notify.notified().await;
        }
    }

}

/// Main WebSocket handler for terminal connections
#[utoipa::path(
    get,
    path = "/api/terminal/{id}",
    responses(
        (status = 200, description = "Websocket connection", body = String)
    ),
    params(
        ("id" = String, Path, description = "The id of the console to connect to, either the machine id or 'manager'"),
    )
)]
pub async fn direct_terminal(ws: WebSocketUpgrade, Path(id): Path<String>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_terminal_connection(socket, id))
}

/// Handle a new terminal WebSocket connection
async fn handle_terminal_connection(socket: WebSocket, id: String) {
    info!("New terminal connection for: {}", id);

    let (ws_sender, mut ws_receiver) = socket.split();
    let ws_sender = Arc::new(Mutex::new(ws_sender));

    // Wait for START message from client
    let terminal_size = match ws_receiver.next().await {
        Some(Ok(msg)) => {
            match TerminalMessage::parse(msg) {
                Some(TerminalMessage::Start(rows, cols)) => {
                    debug!("Terminal started with size: {}x{}", rows, cols);
                    Some((rows, cols))
                }
                _ => {
                    warn!("Expected START message, got something else");
                    return;
                }
            }
        }
        _ => {
            warn!("Connection closed before START message");
            return;
        }
    };

    // Spawn PTY process
    let (pty_reader, pty_writer, mut child) = match spawn_pty_process(&id, terminal_size).await {
        Ok(result) => result,
        Err(e) => {
            error!("Failed to spawn PTY: {}", e);
            let _ = ws_sender.lock().await.send(Message::Close(Some(CloseFrame {
                code: close_code::ERROR,
                reason: format!("Failed to spawn PTY: {}", e).into(),
            }))).await;
            return;
        }
    };

    let pty_writer = Arc::new(Mutex::new(pty_writer));
    let flow_control = Arc::new(FlowControl::new());
    let shutdown = Arc::new(Notify::new());

    // Channel for PTY output
    let (pty_tx, pty_rx) = mpsc::unbounded_channel::<Bytes>();

    // Spawn PTY reader task
    let shutdown_clone = shutdown.clone();
    let pty_reader_task = tokio::spawn(async move {
        pty_reader_loop(pty_reader, pty_tx, shutdown_clone).await;
    });

    // Spawn PTY-to-WebSocket sender task
    let ws_sender_clone = ws_sender.clone();
    let flow_control_clone = flow_control.clone();
    let shutdown_clone = shutdown.clone();
    let ws_sender_task = tokio::spawn(async move {
        ws_sender_loop(ws_sender_clone, pty_rx, flow_control_clone, shutdown_clone).await;
    });

    // Spawn WebSocket-to-PTY receiver task
    let pty_writer_clone = pty_writer.clone();
    let flow_control_clone = flow_control.clone();
    let shutdown_clone = shutdown.clone();
    let ws_receiver_task = tokio::spawn(async move {
        ws_receiver_loop(ws_receiver, pty_writer_clone, flow_control_clone, shutdown_clone).await;
    });

    // Wait for child process to exit
    let exit_status = match child.wait().await {
        Ok(status) => {
            let code = status.code().unwrap_or(0);
            info!("PTY process exited with code: {}", code);
            format!("Process exited with code {}", code)
        }
        Err(e) => {
            error!("Error waiting for PTY process: {}", e);
            format!("Process error: {}", e)
        }
    };

    // Signal shutdown to all tasks
    shutdown.notify_waiters();

    // Send close message to client
    let _ = ws_sender.lock().await.send(Message::Close(Some(CloseFrame {
        code: close_code::NORMAL,
        reason: exit_status.into(),
    }))).await;

    // Wait for all tasks to complete
    let _ = tokio::join!(pty_reader_task, ws_sender_task, ws_receiver_task);

    info!("Terminal connection closed for: {}", id);
}

/// Spawn a PTY process (local shell or SSH)
async fn spawn_pty_process(
    id: &str,
    terminal_size: Option<(u16, u16)>,
) -> anyhow::Result<(pty_process::OwnedReadPty, OwnedWritePty, tokio::process::Child)> {
    // Create PTY
    let pty = Pty::new()?;

    // Set terminal size if provided
    if let Some((rows, cols)) = terminal_size {
        pty.resize(Size::new(rows, cols))?;
    }

    let pts = pty.pts()?;

    // Build command
    let mut command = pty_process::Command::new("/bin/bash");

    // Setup SSH if not manager
    let mut _tempfile: Option<NamedTempFile> = None;

    if id != "manager" {
        let config = get_current_config_cloned!();
        let machine = config
            .get_machine_by_id(id)
            .ok_or_else(|| anyhow::anyhow!("Machine not found: {}", id))?;

        let ssh = &machine.ssh;

        // Create temporary password file for sshpass
        let mut tempfile = NamedTempFile::new()?;
        writeln!(tempfile, "{}", ssh.ssh_password)?;
        let pw_path = tempfile.path().to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid temp file path"))?;

        let hostname = ssh.remote_hostname.clone().unwrap_or_else(|| machine.id.clone());
        let command_str = format!(
            "sshpass -f {} ssh -o StrictHostKeyChecking=no {}@{}",
            pw_path,
            ssh.ssh_username,
            hostname
        );

        debug!("SSH command: {}", command_str);
        command.args(&["-c", &command_str]);

        _tempfile = Some(tempfile); // Keep tempfile alive
    }

    // Spawn the process
    let child = command.spawn(&pts)?;

    // Split PTY into reader and writer
    let (pty_reader, pty_writer) = pty.into_split();

    Ok((pty_reader, pty_writer, child))
}

/// Read from PTY and send to channel
async fn pty_reader_loop(
    mut pty_reader: pty_process::OwnedReadPty,
    pty_tx: mpsc::UnboundedSender<Bytes>,
    shutdown: Arc<Notify>,
) {
    use tokio::io::AsyncReadExt;

    let mut buffer = vec![0u8; PTY_BUFFER_SIZE];

    loop {
        tokio::select! {
            result = pty_reader.read(&mut buffer) => {
                match result {
                    Ok(0) => {
                        debug!("PTY EOF");
                        break;
                    }
                    Ok(n) => {
                        trace!("Read {} bytes from PTY", n);
                        let data = Bytes::copy_from_slice(&buffer[..n]);
                        if pty_tx.send(data).is_err() {
                            debug!("PTY output channel closed");
                            break;
                        }
                    }
                    Err(e) => {
                        // Workaround for "Input/output error (os error 5)" when PTY closes
                        if e.raw_os_error() == Some(5) {
                            debug!("PTY closed (I/O error 5)");
                        } else {
                            error!("PTY read error: {}", e);
                        }
                        break;
                    }
                }
            }
            _ = shutdown.notified() => {
                debug!("PTY reader shutting down");
                break;
            }
        }
    }
}

/// Send PTY output to WebSocket with flow control
async fn ws_sender_loop(
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    mut pty_rx: mpsc::UnboundedReceiver<Bytes>,
    flow_control: Arc<FlowControl>,
    shutdown: Arc<Notify>,
) {
    loop {
        tokio::select! {
            Some(data) = pty_rx.recv() => {
                // Wait if flow control is paused (with timeout to prevent indefinite blocking)
                let flow_timeout = tokio::time::Duration::from_secs(2);
                if tokio::time::timeout(flow_timeout, flow_control.wait_if_paused()).await.is_err() {
                    warn!("Flow control wait timeout - client may be stalled, forcing resume");
                    // Force resume to prevent indefinite hang
                    flow_control.paused.store(false, Ordering::Relaxed);
                }

                let data_len = data.len();

                // Send to WebSocket with timeout to prevent hanging
                let message = Message::Binary(data.into());
                let send_timeout = tokio::time::Duration::from_millis(500);
                match tokio::time::timeout(send_timeout, ws_sender.lock().await.send(message)).await {
                    Ok(Ok(_)) => {
                        trace!("Sent {} bytes to WebSocket", data_len);
                        flow_control.bytes_sent(data_len);
                    }
                    Ok(Err(e)) => {
                        warn!("WebSocket send error: {}", e);
                        break;
                    }
                    Err(_) => {
                        warn!("WebSocket send timeout after 500ms, dropping {} bytes", data_len);
                        // Continue processing - client may have stalled
                    }
                }
            }
            _ = shutdown.notified() => {
                debug!("WebSocket sender shutting down");
                break;
            }
        }
    }
}

/// Receive messages from WebSocket and handle them
async fn ws_receiver_loop(
    mut ws_receiver: SplitStream<WebSocket>,
    pty_writer: Arc<Mutex<OwnedWritePty>>,
    flow_control: Arc<FlowControl>,
    shutdown: Arc<Notify>,
) {
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(msg) => {
                match TerminalMessage::parse(msg) {
                    Some(TerminalMessage::Input(data)) => {
                        // Write input to PTY with timeout to prevent hanging
                        let write_timeout = tokio::time::Duration::from_millis(100);
                        match tokio::time::timeout(write_timeout, pty_writer.lock().await.write_all(&data)).await {
                            Ok(Ok(_)) => {
                                trace!("Wrote {} bytes to PTY", data.len());
                            }
                            Ok(Err(e)) => {
                                error!("PTY write error: {}", e);
                                break;
                            }
                            Err(_) => {
                                warn!("PTY write timeout after 100ms, dropping {} bytes", data.len());
                                // Don't break - continue processing other messages
                            }
                        }
                    }
                    Some(TerminalMessage::Resize(rows, cols)) => {
                        // Resize PTY
                        trace!("Resizing PTY to {}x{}", rows, cols);
                        if let Err(e) = pty_writer.lock().await.resize(Size::new(rows, cols)) {
                            error!("PTY resize error: {}", e);
                        }
                    }
                    Some(TerminalMessage::Ack(bytes)) => {
                        // Handle flow control ACK
                        trace!("Received ACK for {} bytes", bytes);
                        flow_control.bytes_acknowledged(bytes);
                    }
                    Some(TerminalMessage::Start(_, _)) => {
                        warn!("Unexpected START message");
                    }
                    Some(TerminalMessage::Close) => {
                        debug!("Client requested close");
                        break;
                    }
                    Some(TerminalMessage::Ping) => {
                        // Respond to ping
                        trace!("Received ping");
                    }
                    None => {
                        warn!("Failed to parse message");
                    }
                }
            }
            Err(e) => {
                error!("WebSocket receive error: {}", e);
                break;
            }
        }
    }

    shutdown.notify_waiters();
    debug!("WebSocket receiver shutting down");
}
