use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::FilezJob,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/jobs/delete",
    request_body = DeleteJobRequestBody,
    description = "Delete a job from the database",
    responses(
        (status = 200, description = "Deleted a job on the server", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_job(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteJobRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            Some(&[request_body.job_id]),
            AccessPolicyAction::FilezJobsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FilezJob::delete(&database, request_body.job_id).await?,
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

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteJobRequestBody {
    pub job_id: Uuid,
}
