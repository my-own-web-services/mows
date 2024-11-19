/*
With code from https://github.com/papigers/rutty
*/

use axum::{
    extract::{
        ws::{close_code, CloseFrame, Message, WebSocket, WebSocketUpgrade},
        Path,
    },
    response::IntoResponse,
};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use std::io::Write;
use std::{borrow::Cow, sync::Arc};
use std::{pin::Pin, time::Duration};
use tempfile::NamedTempFile;
use tokio::{io::AsyncWriteExt, sync::Notify, time::sleep};
use tracing::{debug, error, trace, warn};

use async_stream::stream;
use bytes::Bytes;
use futures_util::Stream;
use pty_process::{OwnedWritePty, Pty, Size};
use thiserror::Error;
use tokio::process::Child;
use tokio_util::io::ReaderStream;

use crate::get_current_config_cloned;

#[utoipa::path(
    get,
    path = "/api/terminal/{id}",
    responses(
        (status = 200, description = "Websocket connection", body = String)
    ),
    params(
        ("id" = String, Path, description = "The id of the console to connect to, either the machine id or 'local'"),
    )
)]
pub async fn direct_terminal(ws: WebSocketUpgrade, Path(id): Path<String>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| local_shell(socket, id))
}

pub async fn local_shell(mut socket: WebSocket, id: String) {
    trace!("Socket connected");
    trace!("Waiting for message");

    match socket.recv().await {
        Some(Ok(message)) => {
            if let CommandMessage::Start(size) = message.into() {
                match run_command(socket, size, id).await {
                    Ok(_) => (),
                    Err(err) => {
                        error!("Failed to run command: {err}");
                    }
                }
            }
        }
        _ => (),
    }

    trace!("Socket disconnected");
}

async fn run_command(
    socket: WebSocket,
    terminal_size: Option<TerminalSize>,
    id: String,
) -> anyhow::Result<()> {
    let (mut sender, receiver) = futures_util::StreamExt::split(socket);

    let mut tempfile = NamedTempFile::new()?;

    let mut command = Command::new("/bin/bash");

    if id != "manager" {
        let config = get_current_config_cloned!();

        let machine = config.get_machine_by_id(&id).ok_or(anyhow::anyhow!(
            "Failed to find machine with id {} in the current config",
            id
        ))?;

        let ssh = &machine.ssh;

        let pw = &ssh.ssh_password;
        writeln!(tempfile, "{pw}")?;

        let pw_path = tempfile.path().to_str().ok_or(anyhow::anyhow!(
            "Failed to convert password file path to string"
        ))?;
        debug!("Using password file: {pw_path}");

        let command_str = format!(
            "sshpass -f {} ssh {}@{}",
            pw_path,
            machine.ssh.ssh_username,
            ssh.remote_hostname.clone().unwrap_or(machine.id.clone())
        );

        debug!("Running command: {command_str}");
        let args = ["-c", &command_str];
        command.args(args);
    };

    match command.spawn(terminal_size) {
        Err(err) => {
            error!("Failed to spawn command: {err}");
            sender
                .send(Message::Close(Some(CloseFrame {
                    code: close_code::ERROR,
                    reason: Cow::from(err.to_string()),
                })))
                .await
                .unwrap_or_default();

            return Ok(());
        }
        _ => (),
    };

    drop(tempfile);

    let _ = command
        .pid()
        .map_or("N/A".to_string(), |pid| pid.to_string());

    let aborter = Arc::new(Notify::new());
    let (writer, read_stream) = command.read_and_control(aborter.clone());

    let mut send_task = tokio::spawn(message_sender(read_stream, sender));
    let mut recv_task = tokio::spawn(message_receiver(writer, receiver, true));

    let aborter2 = aborter.clone();
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
            aborter.notify_waiters();
            Ok(())
        },
        _ = (&mut recv_task) => {
            send_task.abort();
            aborter2.notify_waiters();
            Ok(())
        },
    }
}

pub(crate) enum CommandStreamItem {
    Output(Bytes),
    Error(String),
    Exit(String),
}

#[derive(Debug, Error)]
pub(crate) enum CommandError {
    #[error("Failed to start command: {0}")]
    Error(String),
}

pub(crate) type CommandStream = Pin<Box<dyn Stream<Item = CommandStreamItem> + Send>>;
pub(crate) type CommandWriter = OwnedWritePty;

pub(crate) struct Command {
    inner: pty_process::Command,
    pty: Option<Pty>,
    child: Option<Child>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct TerminalSize(pub u16, pub u16);

impl TerminalSize {
    pub fn rows(&self) -> u16 {
        self.0
    }
    pub fn cols(&self) -> u16 {
        self.1
    }
}

impl Into<Size> for TerminalSize {
    fn into(self) -> Size {
        Size::new(self.rows(), self.cols())
    }
}

impl Command {
    pub(crate) fn new(program: &str) -> Command {
        Command {
            inner: pty_process::Command::new(program),
            pty: None,
            child: None,
        }
    }

    pub(crate) fn spawn(&mut self, size: Option<TerminalSize>) -> Result<(), CommandError> {
        let pty = match Pty::new() {
            Ok(it) => it,
            Err(e) => return Result::Err(CommandError::Error(e.to_string())),
        };

        if let Some(size) = size {
            pty.resize(size.into()).ok();
        }

        let pts = &pty.pts();
        let pts = match pts {
            Ok(it) => it,
            Err(e) => return Result::Err(CommandError::Error(e.to_string())),
        };

        let child = match self.inner.spawn(&pts) {
            Ok(it) => it,
            Err(e) => return Result::Err(CommandError::Error(e.to_string())),
        };

        self.pty = Some(pty);
        self.child = Some(child);

        Ok(())
    }

    pub(crate) fn args<I, S>(&mut self, args: I) -> &mut Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        self.inner.args(args);
        self
    }

    pub(crate) fn read_and_control(self, aborter: Arc<Notify>) -> (CommandWriter, CommandStream) {
        let (pty_out, pty_in) = self.pty.unwrap().into_split();
        let mut child = self.child.unwrap();
        let mut out_stream = ReaderStream::new(pty_out);

        let stream = futures_util::StreamExt::boxed(stream! {
            loop {
                tokio::select! {
                    Some(output) = out_stream.next() =>
                        match output {
                            Ok(b) => yield CommandStreamItem::Output(b.into()),
                            // workaround against PTY closing incorrect error handling
                            // see: https://stackoverflow.com/questions/72150987/why-does-reading-from-an-exited-pty-process-return-input-output-error-in-rust
                            Err(err) if err.to_string() == "Input/output error (os error 5)" => continue,
                            Err(err) => yield CommandStreamItem::Error(err.to_string()),
                        },
                    status = child.wait() => {
                        match status {
                            Err(err) => yield CommandStreamItem::Error(err.to_string()),
                            Ok(status) => {
                                let code = status.code().unwrap_or(0);
                                yield CommandStreamItem::Exit(format!("Command exited with status code: {code}"));
                                break;
                            }
                        }
                    },
                    _ = aborter.notified() => {
                        match child.start_kill() {
                            Ok(()) => debug!("Command aborted"),
                            Err(err) => error!("Failed to abort command: {err}"),
                        };
                        yield CommandStreamItem::Exit("Aborted".to_string());
                        break;
                    }
                }
                sleep(Duration::from_millis(10)).await;

            }
        });

        (pty_in, stream)
    }

    pub(crate) fn pid(&self) -> Option<u32> {
        self.child.as_ref().unwrap().id()
    }
}

async fn message_sender(mut stream: CommandStream, mut sender: SplitSink<WebSocket, Message>) {
    while let Some(item) = stream.next().await {
        let message = match item {
            CommandStreamItem::Output(bytes) => Some(Message::Binary(bytes.into())),
            CommandStreamItem::Error(err) => {
                warn!("Command reported error: {err}");
                None
            }
            CommandStreamItem::Exit(reason) => Some(Message::Close(Some(CloseFrame {
                code: close_code::NORMAL,
                reason: Cow::from(reason),
            }))),
        };
        if let Some(message) = message {
            let result = sender.send(message).await;

            if let Some(err) = result.err() {
                warn!("Failed to write to socket: {err}");
                break;
            };
        }
        sleep(Duration::from_millis(10)).await;
    }
}

#[derive(Debug)]
enum CommandMessage {
    Start(Option<TerminalSize>),
    Input(Vec<u8>),
    Resize(TerminalSize),
    Irrelevant(Message),
}

const COMMAND_MESSAGE_DELIMITER: &str = ";";
const START_PREFIX: char = '0';
const INPUT_PREFIX: char = '1';
const RESIZE_PREFIX: char = '2';

impl From<String> for CommandMessage {
    fn from(value: String) -> Self {
        let split = value.split(COMMAND_MESSAGE_DELIMITER).collect::<Vec<_>>();
        let prefix = match split.get(0) {
            Some(it) if it.len() == 1 => it,
            _ => return CommandMessage::Input(value.as_bytes().into()),
        };
        let prefix = prefix.chars().nth(0).unwrap();

        let fallback = || CommandMessage::Input(value.as_bytes().to_vec());

        let from = match prefix {
            INPUT_PREFIX => CommandMessage::Input((&value[2..]).into()),
            RESIZE_PREFIX | START_PREFIX => {
                let rows = split.get(1).and_then(|n| n.parse::<u16>().ok());
                let cols = split.get(2).and_then(|n| n.parse::<u16>().ok());
                let is_start = prefix == START_PREFIX;
                if rows.is_none() || cols.is_none() {
                    if is_start {
                        warn!("Failed to parse size from start message: {value}");
                        return CommandMessage::Start(None);
                    }

                    warn!("Failed to parse resize message: {value}");
                    return fallback();
                }

                if is_start {
                    return CommandMessage::Start(Some(TerminalSize(rows.unwrap(), cols.unwrap())));
                }

                CommandMessage::Resize(TerminalSize(rows.unwrap(), cols.unwrap()))
            }
            _ => fallback(),
        };

        from
    }
}

impl From<Message> for CommandMessage {
    fn from(value: Message) -> Self {
        match value {
            Message::Binary(d) => CommandMessage::Input(d),
            Message::Text(t) => t.into(),
            msg => CommandMessage::Irrelevant(msg),
        }
    }
}

async fn message_receiver(
    mut writer: CommandWriter,
    mut receiver: futures_util::stream::SplitStream<WebSocket>,
    allow_write: bool,
) {
    while let Some(Ok(msg)) = receiver.next().await {
        let result = match CommandMessage::from(msg) {
            CommandMessage::Input(d) => {
                if !allow_write {
                    continue;
                }
                writer.write(d.as_slice()).await
            }
            CommandMessage::Resize(size) => {
                match writer.resize(size.into()) {
                    Err(e) => error!("Failed to resize to {size:?}: {e}"),
                    _ => (),
                };
                Ok(0)
            }
            CommandMessage::Start(_) => {
                warn!("Unexpected start message");
                continue;
            }
            CommandMessage::Irrelevant(inner) => {
                if let Message::Close(_) = inner {
                    break;
                }
                continue;
            }
        };

        if let Some(err) = result.err() {
            warn!("Failed to write to command: {err}");
            break;
        }
        sleep(Duration::from_millis(10)).await;
    }
}
