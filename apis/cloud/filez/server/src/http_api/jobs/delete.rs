use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::{FilezJob, FilezJobId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};


#[utoipa::path(
    delete,
    path = "/api/jobs/delete/{job_id}",
    params(
        (
            "job_id" = FilezJobId,
            Path, 
            description = "The ID of the job to delete"
        )
    ),
    description = "Delete a job from the database",
    responses(
        (
            status = 200,
            description = "Deleted the job",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(job_id): Path<FilezJobId>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            Some(&[job_id.into()]),
            AccessPolicyAction::FilezJobsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FilezJob::delete_one(&database, job_id).await?,
        "Database operation to delete a job",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse::<EmptyApiResponse> {
            status: ApiResponseStatus::Success {},
            message: "Deleted Job".to_string(),
            data: None,
        }),
    ))
}
