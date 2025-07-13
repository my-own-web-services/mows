use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
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
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/create",
    request_body = CreateFileGroupRequestBody,
    responses(
        (status = 200, description = "Creates a new file group", body = ApiResponse<FileGroup>),
    )
)]
pub async fn create_file_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<CreateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
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
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupsCreate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = FileGroup::new(&requesting_user, &req_body.name, req_body.group_type);

    with_timing!(
        FileGroup::create(&db, &file_group).await?,
        "Database operation to create file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "File group created".to_string(),
        data: Some(file_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileGroupRequestBody {
    pub name: String,
    pub group_type: FileGroupType,
}
