use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsAppId,
        jobs::{FilezJob, JobExecutionInformation, JobPersistenceType},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/create",
    request_body = CreateJobRequestBody,
    description = "Create a new job in the database",
    responses(
        (
            status = 200,
            description = "Created a job on the server",
            body = ApiResponse<CreateJobResponseBody>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
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

    let created_job = with_timing!(
        FilezJob::create_one(
            &database,
            authentication_information
                .requesting_user
                .unwrap()
                .id
                .into(),
            request_body.job_handling_app_id,
            request_body.job_name,
            request_body.job_execution_details,
            request_body.job_persistence,
            request_body.job_deadline_time,
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
            data: Some(CreateJobResponseBody { created_job }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateJobRequestBody {
    pub job_handling_app_id: MowsAppId,
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub job_name: String,
    pub job_execution_details: JobExecutionInformation,
    pub job_persistence: JobPersistenceType,
    pub job_deadline_time: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
}
