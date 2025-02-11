pub mod config_api {

    use crate::{
        config::{config, ManagerConfig},
        get_current_config_cloned,
        types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
        write_config,
    };
    use axum::{
        extract::{
            ws::{Message, WebSocket},
            WebSocketUpgrade,
        },
        response::IntoResponse,
        Json,
    };
    use tracing::info;
    use utoipa_axum::{router::OpenApiRouter, routes};

    pub fn router() -> OpenApiRouter {
        OpenApiRouter::new()
            .routes(routes!(update_config))
            .routes(routes!(get_config))
    }

    #[utoipa::path(
    put,
    path = "",
    request_body = ManagerConfig,
    responses(
        (status = 200, description = "Config updated", body = ApiResponse<EmptyApiResponse>),
    )
)]
    pub async fn update_config(Json(posted_config): Json<ManagerConfig>) -> Json<ApiResponse<()>> {
        let mut config = write_config!();

        *config = posted_config;

        if let Err(e) = config.apply_environment().await {
            return Json(ApiResponse {
                message: format!("Failed to apply environment: {}", e),
                status: ApiResponseStatus::Error,
                data: None,
            });
        }

        info!("Config updated");

        Json(ApiResponse {
            message: "Config updated".to_string(),
            status: ApiResponseStatus::Success,
            data: None,
        })
    }

    #[utoipa::path(
    get,
    path = "",
    responses(
        (status = 101, description = "Websocket that updates the current config", body = ManagerConfig),  
    )
)]
    pub async fn get_config(ws: WebSocketUpgrade) -> impl IntoResponse {
        ws.on_upgrade(move |socket| handle_get_config(socket))
    }

    pub async fn handle_get_config(mut socket: WebSocket) {
        loop {
            let config = get_current_config_cloned!();

            let message = Message::Text(serde_json::to_string(&config).unwrap().into());
            match socket.send(message).await {
                Ok(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    continue;
                }
                Err(_) => break,
            }
        }
    }
}
