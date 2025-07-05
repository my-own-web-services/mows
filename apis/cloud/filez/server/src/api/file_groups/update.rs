use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_groups::FileGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/file_groups/{file_group_id}",
    request_body = UpdateFileGroupRequestBody,
    responses(
        (status = 200, description = "Updates a file group", body = ApiResponse<FileGroup>),
    )
)]
pub async fn update_file_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<Uuid>,
    Json(req_body): Json<UpdateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_by_external_id(&db, &external_user.user_id).await?,
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
            Some(&vec![file_group_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupUpdate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FileGroup::update(&db, &file_group_id, &req_body.name).await?,
        "Database operation to update file group",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&db, &file_group_id).await?,
        "Database operation to get updated file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "File group updated".to_string(),
        data: Some(file_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileGroupRequestBody {
    pub name: String,
}
