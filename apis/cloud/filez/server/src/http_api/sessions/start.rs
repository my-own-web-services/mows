use crate::{
    config::SESSION_INFO_KEY,
    errors::FilezError,
    http_api::authentication::{middleware::AuthenticationInformation, sessions::SessionInfo},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use tower_sessions::Session;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/sessions/start",
    request_body = StartSessionRequestBody,
    description = "Starts a new session valid for get requests from the same origin",
    responses(
        (
            status = 201,
            description = "Started a session",
            body = ApiResponse<StartSessionResponseBody>
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
pub async fn start_session(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState {
        introspection_state,
        ..
    }): State<ServerState>,
    maybe_bearer: Option<TypedHeader<Authorization<Bearer>>>,
    session: Session,
    Json(request_body): Json<StartSessionRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    match authentication_information.requesting_user {
        Some(user) => {
            session
                .insert(
                    SESSION_INFO_KEY,
                    SessionInfo {
                        user_id: user.id,
                        app_id: authentication_information.requesting_app.id,
                    },
                )
                .await?;

            Ok((
                StatusCode::CREATED,
                Json(ApiResponse {
                    status: ApiResponseStatus::Success {},
                    message: "Created Session".to_string(),
                    data: Some(StartSessionResponseBody {}),
                }),
            ))
        }
        None => Err(FilezError::Unauthorized(
            "Missing Authorization Bearer Token".to_string(),
        )),
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct StartSessionRequestBody {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct StartSessionResponseBody {}
