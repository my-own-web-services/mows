use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::{FilezJob, FilezJobId, UpdateJobChangeset},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/update",
    request_body = UpdateJobRequestBody,
    description = "Update a job in the database",
    responses(
        (
            status = 200,
            description = "Updated a job on the server",
            body = ApiResponse<UpdateJobResponseBody>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            Some(&[request_body.job_id.into()]),
            AccessPolicyAction::FilezJobsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_job = with_timing!(
        FilezJob::update_one(&database, request_body.job_id, request_body.changeset,).await?,
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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateJobRequestBody {
    pub job_id: FilezJobId,
    pub changeset: UpdateJobChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}
