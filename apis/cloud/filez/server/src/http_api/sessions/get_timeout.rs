use crate::{
    errors::FilezError,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};
use axum::{http::StatusCode, response::IntoResponse, Json};
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    get,
    path = "/api/sessions/timeout",
    description = "Get the session timeout on inactivity in seconds",
    responses(
        (
            status = 200,
            description = "Session timeout retrieved",
            body = ApiResponse<GetSessionTimeoutResponseBody>
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
pub async fn get_session_timeout() -> Result<impl IntoResponse, FilezError> {
    let config = get_current_config_cloned!(crate::config::config());

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Session timeout retrieved".to_string(),
            data: Some(GetSessionTimeoutResponseBody {
                inactivity_timeout_seconds: config.session_timeout_on_inactivity_seconds,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetSessionTimeoutResponseBody {
    pub inactivity_timeout_seconds: i64,
}
