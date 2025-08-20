use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{FileGroup, FileGroupId, FileGroupType},
        files::FilezFileId,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/update_members",
    request_body = UpdateFileGroupMembersRequestBody,
    responses(
        (status = 200, description = "Updates the members of a file group", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_file_group_members(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileGroupMembersRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id.into()]),
            AccessPolicyAction::FileGroupsUpdateMembers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&database, &request_body.file_group_id).await?,
        "Database operation to get file group by ID",
        timing
    );

    if file_group.group_type != FileGroupType::Manual {
        return Err(FilezError::InvalidRequest(
            "File group is not a manual group".to_string(),
        ));
    }

    if let Some(files_to_add) = request_body.files_to_add {
        with_timing!(
            FileGroup::add_files(&database, &request_body.file_group_id, &files_to_add).await?,
            "Database operation to add files to file group",
            timing
        );
    }

    if let Some(files_to_remove) = request_body.files_to_remove {
        with_timing!(
            FileGroup::remove_files(&database, &request_body.file_group_id, &files_to_remove)
                .await?,
            "Database operation to remove files from file group",
            timing
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group members updated".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: FileGroupId,
    pub files_to_add: Option<Vec<FilezFileId>>,
    pub files_to_remove: Option<Vec<FilezFileId>>,
}
