use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::{
            FilezJob, JobExecutionInformation, JobPersistenceType, JobStatus, JobStatusDetails,
        },
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/jobs/update",
    request_body = UpdateJobRequestBody,
    description = "Update a job in the database",
    responses(
        (status = 200, description = "Updated a job on the server", body = ApiResponse<UpdateJobResponseBody>),
    )
)]
pub async fn update_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let mut job = with_timing!(
        FilezJob::get_by_id(&database, request_body.job_id).await?,
        "Database operation to get a job",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            Some(&[job.id]),
            AccessPolicyAction::FilezJobsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    if let Some(name) = request_body.name {
        job.name = name;
    }
    if let Some(status) = request_body.status {
        job.status = status;
    }
    if let Some(status_details) = request_body.status_details {
        job.status_details = Some(status_details);
    }
    if let Some(execution_information) = request_body.execution_information {
        job.execution_information = execution_information;
    }
    if let Some(persistence) = request_body.persistence {
        job.persistence = persistence;
    }
    if let Some(deadline_time) = request_body.deadline_time {
        job.deadline_time = Some(deadline_time);
    }

    let updated_job = with_timing!(
        FilezJob::update(&database, &job).await?,
        "Database operation to update a job",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Updated Job".to_string(),
            data: Some(UpdateJobResponseBody { job: updated_job }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateJobRequestBody {
    pub job_id: Uuid,
    pub name: Option<String>,
    pub status: Option<JobStatus>,
    pub status_details: Option<JobStatusDetails>,
    pub execution_information: Option<JobExecutionInformation>,
    pub persistence: Option<JobPersistenceType>,
    pub deadline_time: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}
