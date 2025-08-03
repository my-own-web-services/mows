use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::{FilezJob, JobExecutionInformation, JobPersistenceType},
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
    path = "/api/jobs/create",
    request_body = CreateJobRequestBody,
    description = "Create a new job in the database",
    responses(
        (status = 200, description = "Created a job on the server", body = ApiResponse<CreateJobResponseBody>),
    )
)]
pub async fn create_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            None,
            AccessPolicyAction::FilezJobsCreate,
        )
        .await?
        .verify_allow_type_level()?,
        "Database operation to check access control",
        timing
    );

    let db_created_job = with_timing!(
        FilezJob::create(
            &database,
            authentication_information.requesting_user.unwrap().id,
            request_body.app_id,
            request_body.name,
            request_body.execution_details,
            request_body.persistence,
            request_body.deadline_time,
        )
        .await?,
        "Database operation to create a new job",
        timing
    );

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Created Job".to_string(),
            data: Some(CreateJobResponseBody {
                created_job: db_created_job,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateJobRequestBody {
    pub app_id: Uuid,
    pub name: String,
    pub execution_details: JobExecutionInformation,
    pub persistence: JobPersistenceType,
    pub deadline_time: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
}
