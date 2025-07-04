use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortOrder},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list_files",
    request_body = ListFilesRequestBody,
    responses(
        (status = 200, description = "Lists the files in a given group", body = ApiResponse<ListFilesResponseBody>),
    )
)]
pub async fn list_files(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<ListFilesRequestBody>,
) -> Result<Json<ApiResponse<ListFilesResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        db.check_resources_access_control(
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            &vec![req_body.file_group_id],
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupListItems).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_files_query = db.list_files_by_file_group(
        &req_body.file_group_id,
        req_body.from_index,
        req_body.limit,
        req_body.sort_by.as_deref(),
        req_body.sort_order,
    );

    let file_group_item_count_query = db.get_file_group_item_count(&req_body.file_group_id);

    // join the two futures to run them concurrently
    let (files, total_count) = match tokio::join!(list_files_query, file_group_item_count_query) {
        (Ok(files), Ok(total_count)) => (files, total_count),
        (Err(e), _) => return Err(e),
        (_, Err(e)) => return Err(e),
    };

    return Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got file list".to_string(),
        data: Some(ListFilesResponseBody { files, total_count }),
    }));
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesRequestBody {
    pub file_group_id: Uuid,
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<SortOrder>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: i64,
}
