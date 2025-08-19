use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::jobs::{FilezJob, JobStatus, JobStatusDetails},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use tracing::{instrument, trace};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/apps/update_status",
    request_body = UpdateJobStatusRequestBody,
    description = "Updates the status of a job on the server",
    responses(
        (status = 200, description = "Updated job status on the server", body = ApiResponse<UpdateJobStatusResponseBody>),
    )
)]
#[instrument(skip(database))]
pub async fn update_job_status(
    Extension(AuthenticationInformation {
        requesting_app,
        requesting_app_runtime_instance_id,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateJobStatusRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    trace!(
        requesting_app = ?requesting_app,
        requesting_app_runtime_instance_id = ?requesting_app_runtime_instance_id,
        "Received request to pickup job by app: {:?} with runtime instance ID: {:?}",
        requesting_app,
        requesting_app_runtime_instance_id
    );

    let requesting_app_runtime_instance_id = requesting_app_runtime_instance_id.ok_or(
        FilezError::Unauthorized("Requesting app runtime instance ID is required".to_string()),
    )?;

    let job = with_timing!(
        FilezJob::update_status(
            &database,
            requesting_app.clone(),
            requesting_app_runtime_instance_id.clone(),
            request_body.new_status.clone(),
            request_body.new_status_details.clone()
        )
        .await?,
        "Database operation to pickup a job",
        timing
    );

    trace!(
        job = ?job,
        requesting_app = ?requesting_app,
        requesting_app_runtime_instance_id = ?requesting_app_runtime_instance_id,
        new_status = ?request_body.new_status,
        new_status_details = ?request_body.new_status_details,
        "Job status updated: {:?} by app: {:?} with runtime instance ID: {:?}, new status: {:?}, new status details: {:?}",
        job,
        requesting_app,
        requesting_app_runtime_instance_id,
        request_body.new_status,
        request_body.new_status_details
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Job status updated".to_string(),
            data: Some(UpdateJobStatusResponseBody { job }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateJobStatusRequestBody {
    pub new_status: JobStatus,
    pub new_status_details: Option<JobStatusDetails>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateJobStatusResponseBody {
    pub job: FilezJob,
}
