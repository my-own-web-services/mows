use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_groups::{FileGroup, FileGroupType},
        users::FilezUser,
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
pub async fn update_file_group_members(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileGroupMembersRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id]),
            AccessPolicyAction::FileGroupsUpdateMembers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&db, &request_body.file_group_id).await?,
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
            FileGroup::add_files(&db, &request_body.file_group_id, &files_to_add).await?,
            "Database operation to add files to file group",
            timing
        );
    }

    if let Some(files_to_remove) = request_body.files_to_remove {
        with_timing!(
            FileGroup::remove_files(&db, &request_body.file_group_id, &files_to_remove).await?,
            "Database operation to remove files from file group",
            timing
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "File group members updated".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: Uuid,
    pub files_to_add: Option<Vec<Uuid>>,
    pub files_to_remove: Option<Vec<Uuid>>,
}
