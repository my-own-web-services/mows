use crate::{
    config::SESSION_INFO_KEY,
    errors::FilezError,
    http_api::authentication::sessions::SessionInfo,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    utils::get_current_timestamp,
};
use axum::{http::StatusCode, response::IntoResponse, Json};
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use tower_sessions::Session;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/sessions/refresh",
    request_body = RefreshSessionRequestBody,
    description = "Refreshes an existing session by updating the last_seen timestamp",
    responses(
        (
            status = 200,
            description = "Session refreshed successfully",
            body = ApiResponse<RefreshSessionResponseBody>
        ),
        (
            status = 401,
            description = "Unauthorized - No active session",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(level = "trace")]
#[axum::debug_handler]
pub async fn refresh_session(
    session: Session,
    Json(request_body): Json<RefreshSessionRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    // Get the current session info
    let mut session_info: SessionInfo = session
        .get(SESSION_INFO_KEY)
        .await?
        .ok_or_else(|| FilezError::Unauthorized("No active session".to_string()))?;

    // Update the last_seen timestamp
    session_info.last_seen = get_current_timestamp();

    // Save the updated session info
    session.insert(SESSION_INFO_KEY, session_info).await?;

    let config = get_current_config_cloned!(crate::config::config());

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Session refreshed".to_string(),
            data: Some(RefreshSessionResponseBody {
                inactivity_timeout_seconds: config.session_timeout_on_inactivity_seconds,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct RefreshSessionRequestBody {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct RefreshSessionResponseBody {
    pub inactivity_timeout_seconds: i64,
}
