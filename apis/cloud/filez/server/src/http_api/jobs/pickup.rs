use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::jobs::FilezJob,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/pickup",
    request_body = PickupJobRequestBody,
    description = "Pickup a job from the server",
    responses(
        (status = 200, description = "Picked up a job from the server", body = ApiResponse<PickupJobResponseBody>),
    )
)]
pub async fn pickup_job(
    Extension(AuthenticationInformation { requesting_app, .. }): Extension<
        AuthenticationInformation,
    >,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<PickupJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let job = with_timing!(
        FilezJob::pickup(
            &database,
            requesting_app.id,
            &request_body.app_runtime_instance_id
        )
        .await?,
        "Database operation to pickup a job",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Picked up Job".to_string(),
            data: Some(PickupJobResponseBody { job }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct PickupJobRequestBody {
    pub app_runtime_instance_id: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}
