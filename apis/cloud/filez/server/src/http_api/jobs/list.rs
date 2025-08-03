use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        jobs::FilezJob,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/jobs/list",
    request_body = ListJobsRequestBody,
    responses(
        (status = 200, description = "Lists jobs", body = ApiResponse<ListJobsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_jobs(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListJobsRequestBody>,
) -> Result<Json<ApiResponse<ListJobsResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FilezJob,
            None,
            AccessPolicyAction::FilezJobsList,
            
        )
        .await?
        .verify_allow_type_level()?,
        "Checking access policy for user and app",
        timing
    );

    let jobs = with_timing!(
        FilezJob::list(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list jobs",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Jobs listed".to_string(),
        data: Some(ListJobsResponseBody { jobs }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListJobsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListJobsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListJobsResponseBody {
    pub jobs: Vec<FilezJob>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Copy)]
pub enum ListJobsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
