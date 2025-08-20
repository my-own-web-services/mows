use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::{FilezJob, FilezJobId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/jobs/get",
    request_body = GetJobRequestBody,
    description = "Get a job from the database",
    responses(
        (status = 200, description = "Got a job from the server", body = ApiResponse<GetJobResponseBody>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            Some(&[request_body.job_id.into()]),
            AccessPolicyAction::FilezJobsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let job = with_timing!(
        FilezJob::get_by_id(&database, request_body.job_id).await?,
        "Database operation to get a job",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Got Job".to_string(),
            data: Some(GetJobResponseBody { job }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetJobRequestBody {
    pub job_id: FilezJobId,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetJobResponseBody {
    pub job: FilezJob,
}
