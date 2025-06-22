use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    models::{AccessPolicyAction, AccessPolicyResourceType, File},
    types::{ApiResponse, ApiResponseStatus, AppState, SortOrder},
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
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<ListFilesRequestBody>,
) -> Json<ApiResponse<ListFilesResponseBody>> {
    let requesting_user = match app_state
        .db
        .get_user_by_external_id(&external_user.user_id)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: "User not found".to_string(),
                data: None,
            });
        }
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Database error: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.get_user_by_external_id".to_string(),
        Some("Database operation to get user by external ID".to_string()),
    );

    let requesting_app = match app_state.db.get_app_from_headers(&request_headers).await {
        Ok(app) => app,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get app from headers: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.get_app_from_headers".to_string(),
        Some("Database operation to get app from headers".to_string()),
    );

    match app_state
        .db
        .check_resources_access_control(
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            &vec![req_body.file_group_id],
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupListItems).unwrap(),
        )
        .await
    {
        Ok(auth_result) => {
            if auth_result.access_denied {
                return Json(ApiResponse {
                    status: ApiResponseStatus::Error,
                    message: "Access denied".to_string(),
                    data: None,
                });
            }
        }
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Access control check failed: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.check_resources_access_control".to_string(),
        Some("Database operation to check access control".to_string()),
    );

    let list_files_query = app_state.db.list_files_by_file_group(
        &req_body.file_group_id,
        req_body.from_index,
        req_body.limit,
        req_body.sort_by.as_deref(),
        req_body.sort_order,
    );

    let file_group_item_count_query = app_state
        .db
        .get_file_group_item_count(&req_body.file_group_id);

    // join the two futures to run them concurrently
    let (files, total_count) = match tokio::join!(list_files_query, file_group_item_count_query) {
        (Ok(files), Ok(total_count)) => (files, total_count),
        (Err(e), _) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to list files: {}", e),
                data: None,
            });
        }
        (_, Err(e)) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get file group item count: {}", e),
                data: None,
            });
        }
    };

    return Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got file list".to_string(),
        data: Some(ListFilesResponseBody { files, total_count }),
    });
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
    pub files: Vec<File>,
    pub total_count: i64,
}
