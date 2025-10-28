use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{FileGroup, FileGroupId, UpdateFileGroupChangeset},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/file_groups/update",
    request_body = UpdateFileGroupRequestBody,
    description = "Update a file group",
    responses(
        (
            status = 200,
            description = "Updated the file group",
            body = ApiResponse<UpdateFileGroupResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<UpdateFileGroupResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id.into()]),
            AccessPolicyAction::FileGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_file_group = with_timing!(
        FileGroup::update_one(
            &database,
            &request_body.file_group_id,
            &request_body.changeset,
        )
        .await?,
        "Database operation to update file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group updated".to_string(),
        data: Some(UpdateFileGroupResponseBody { updated_file_group }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: FileGroupId,
    pub changeset: UpdateFileGroupChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileGroupResponseBody {
    pub updated_file_group: FileGroup,
}
