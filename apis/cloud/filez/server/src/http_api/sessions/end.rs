use crate::{
    config::SESSION_INFO_KEY,
    errors::FilezError,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use tower_sessions::Session;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/sessions/end",
    request_body = EndSessionRequestBody,
    description = "Ends the current session",
    responses(
        (
            status = 200,
            description = "Session ended successfully",
            body = ApiResponse<EndSessionResponseBody>
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
pub async fn end_session(
    State(ServerState { .. }): State<ServerState>,
    session: Session,
    Json(request_body): Json<EndSessionRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    // Remove the session info from the session store
    session.remove::<()>(SESSION_INFO_KEY).await?;

    // Delete the entire session
    session.delete().await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Session ended".to_string(),
            data: Some(EndSessionResponseBody {}),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct EndSessionRequestBody {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct EndSessionResponseBody {}
