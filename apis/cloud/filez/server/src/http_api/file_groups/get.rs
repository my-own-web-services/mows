use axum::{extract::State, Extension};
use crate::validation::Json;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{FileGroup, FileGroupId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    get,
    path = "/api/file_groups/get",
    description = "Gets file groups by their IDs",
    request_body = GetFileGroupsRequestBody,
    responses(
        (
            status = 200,
            description = "Got the file groups",
            body = ApiResponse<GetFileGroupsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFileGroupsRequestBody>,
) -> Result<Json<ApiResponse<GetFileGroupsResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(
                &request_body
                    .file_group_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<_>>()
            ),
            AccessPolicyAction::FileGroupsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_groups = with_timing!(
        FileGroup::get_many_by_ids(&database, &request_body.file_group_ids).await?,
        "Database operation to get file group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File groups retrieved".to_string(),
        data: Some(GetFileGroupsResponseBody { file_groups }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetFileGroupsRequestBody {
    pub file_group_ids: Vec<FileGroupId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}
