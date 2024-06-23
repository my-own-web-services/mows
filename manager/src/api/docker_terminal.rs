use anyhow::bail;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use bollard::{
    exec::{CreateExecOptions, StartExecResults},
    Docker,
};
use futures::StreamExt;
use std::io::Write;
use tempfile::NamedTempFile;
use tokio::io::AsyncWriteExt;
use tracing::debug;

use crate::get_current_config_cloned;

#[utoipa::path(
    get,
    path = "/api/terminal/docker/{id}",
    responses(
        (status = 200, description = "Websocket connection", body = String)
    ),
    params(
        ("id" = String, Path, description = "The id of the console to connect to, either the machine id or 'local'"),

    )
)]
pub async fn docker_terminal(ws: WebSocketUpgrade, Path(id): Path<String>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, id))
}
async fn setup_container_shell(container_id: &str) -> anyhow::Result<StartExecResults> {
    let docker = Docker::connect_with_local_defaults()?;
    let create_options = CreateExecOptions {
        cmd: Some(vec!["/bin/bash"]),
        attach_stdin: Some(true),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(true),
        ..Default::default()
    };
    let exec = docker.create_exec(container_id, create_options).await?;

    Ok(docker.start_exec(&exec.id, None).await?)
}

pub async fn handle_ws(socket: WebSocket, id: String) {
    let _ = docker_shell(socket, id).await;
}

async fn docker_shell(mut websocket: WebSocket, id: String) -> anyhow::Result<()> {
    let (mut shell_stdin, mut shell_stdout) = match setup_container_shell("mows-manager").await? {
        StartExecResults::Detached => {
            bail!("Could not setup and attach to shell in container");
        }
        StartExecResults::Attached { input, output } => (input, output),
    };

    if id != "local" {
        let config = get_current_config_cloned!();
        let (_, selected_node) = config
            .clusters
            .iter()
            .flat_map(|(_, cluster)| cluster.cluster_nodes.iter())
            .find(|(node_id, _)| **node_id == id)
            .ok_or(anyhow::anyhow!(
                "Failed to find node with id {id} in the current config"
            ))?;

        let mut tempfile = NamedTempFile::new()?;

        let pw = &selected_node.ssh.ssh_password;
        writeln!(tempfile, "{pw}")?;

        let pw_path = tempfile.path().to_str().ok_or(anyhow::anyhow!(
            "Failed to convert password file path to string"
        ))?;
        debug!("Using password file: {pw_path}");

        let command_str = format!(
            "sshpass -f {} ssh {}@{} \n",
            pw_path, selected_node.ssh.ssh_username, selected_node.hostname
        );

        debug!("Running command: {command_str}");
        shell_stdin.write_all(command_str.as_bytes()).await?;
        // check if the ssh session was started
        let r = shell_stdout.next().await;
        dbg!(&r);
        let r2 = shell_stdout.next().await;
        dbg!(&r2);
    }
    loop {
        tokio::select! {
            Some(Ok(msg)) = websocket.next() => {
                if let Message::Text(msg) = msg {
                    let msg = if msg == "\r" { "\n".into() } else { msg };
                    shell_stdin.write_all(msg.as_bytes()).await?;
                }
            }

            Some(Ok(output)) = shell_stdout.next() => {
                if let bollard::container::LogOutput::StdOut { message } = output {
                    websocket.send(Message::Binary(message.to_vec())).await?;
                }
            }

        }
    }
}
