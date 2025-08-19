use axum::{
    extract::{Path, State},
    Extension, Json,
};

use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::FileGroup,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    delete,
    path = "/api/file_groups/delete/{file_group_id}",
    params(
        (
            "file_group_id" = Uuid,
            Path,
            description = "The ID of the file group to delete"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Deletes a file group",
            body = ApiResponse<String>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
pub async fn delete_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<Uuid>,
) -> Result<Json<ApiResponse<String>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![file_group_id]),
            AccessPolicyAction::FileGroupsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FileGroup::delete(&database, &file_group_id).await?,
        "Database operation to delete file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group deleted".to_string(),
        data: Some(file_group_id.to_string()),
    }))
}
