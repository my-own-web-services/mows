use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};

use std::process::Stdio;
use tokio::process::Command;

#[utoipa::path(
    get,
    path = "/api/terminal/local",
    responses(
        (status = 200, description = "Websocket connection", body = [String])
    )
)]
pub async fn websocket_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(local_shell)
}

pub async fn local_shell(mut socket: WebSocket) {
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(command) = msg {
            let output = Command::new("sh")
                .arg("-c")
                .arg(&command)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
                .expect("failed to execute command");

            let output_string = String::from_utf8_lossy(&output.stdout).to_string();
            let error_string = String::from_utf8_lossy(&output.stderr).to_string();

            let response = if error_string.is_empty() {
                output_string
            } else {
                format!("Error: {}", error_string)
            };

            if socket.send(Message::Text(response)).await.is_err() {
                break;
            }
        }
    }
}
