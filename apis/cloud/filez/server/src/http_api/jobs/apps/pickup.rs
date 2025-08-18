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
use tracing::{debug, trace};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/apps/pickup",
    request_body = PickupJobRequestBody,
    description = "Pickup a job from the server",
    responses(
        (status = 200, description = "Picked up a job from the server", body = ApiResponse<PickupJobResponseBody>),
    )
)]
pub async fn pickup_job(
    Extension(AuthenticationInformation {
        requesting_app,
        requesting_app_runtime_instance_id,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(_request_body): Json<PickupJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    trace!(
        requesting_app = ?requesting_app,
        requesting_app_runtime_instance_id = ?requesting_app_runtime_instance_id,
        "Received request to pickup job by app: {:?} with runtime instance ID: {:?}",
        requesting_app,
        requesting_app_runtime_instance_id
    );

    let job = with_timing!(
        FilezJob::pickup(
            &database,
            requesting_app.clone(),
            requesting_app_runtime_instance_id.clone(),
        )
        .await?,
        "Database operation to pickup a job",
        timing
    );

    trace!(
        job = ?job,
        requesting_app = ?requesting_app,
        requesting_app_runtime_instance_id = ?requesting_app_runtime_instance_id,
        "Job picked up: {:?} by app: {:?} with runtime instance ID: {:?}",
        job,
        requesting_app,
        requesting_app_runtime_instance_id
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
pub struct PickupJobRequestBody {}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}
