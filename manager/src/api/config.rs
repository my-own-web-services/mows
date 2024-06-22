use crate::{
    config::{config, ManagerConfig},
    types::Success,
    utils::AppError,
    write_config,
};
use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::IntoResponse,
    Json,
};
use tracing::info;

#[utoipa::path(
    put,
    path = "/api/config",
    request_body = ManagerConfig,
    responses(
        (status = 200, description = "Updates the config", body = Success),
        (status = 500, description = "Failed to update config", body = String)
    )
)]
pub async fn update_config(
    Json(posted_config): Json<ManagerConfig>,
) -> Result<Json<Success>, AppError> {
    let mut config = write_config!();

    *config = posted_config;

    config.apply_environment().await?;

    info!("Config updated");

    Ok(Json(Success {
        message: "Config updated".to_string(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/config",
    responses(
        (status = 101, description = "Websocket", body = ManagerConfig),  
    )
)]
pub async fn get_config(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_get_config(socket))
}

// send the config to the client every time and only if it changes the config is a RwLock
pub async fn handle_get_config(mut socket: WebSocket) {
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let config = config().read().await.clone();

        let message = Message::Text(serde_json::to_string(&config).unwrap());
        match socket.send(message).await {
            Ok(_) => continue,
            Err(_) => break,
        }
    }
}
