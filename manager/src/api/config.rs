use crate::{
    config::ManagerConfig,
    types::Success,
    utils::{AppError, CONFIG},
};
use axum::Json;

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
    let mut config = CONFIG.write().await;

    *config = posted_config;

    config.apply_environment().await?;

    Ok(Json(Success {
        message: "Config updated".to_string(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/config",
    responses(
        (status = 200, description = "Gets the config", body = ManagerConfig)
    )
)]
pub async fn get_config() -> Json<ManagerConfig> {
    Json(CONFIG.read().await.clone())
}
