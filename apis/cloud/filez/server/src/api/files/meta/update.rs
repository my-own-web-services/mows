use std::collections::HashMap;

use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    models::{AccessPolicyAction, AccessPolicyResourceType},
    types::{ApiResponse, ApiResponseStatus, AppState, EmptyApiResponse},
};

#[utoipa::path(
    post,
    path = "/api/files/meta/update",
    request_body = UpdateFilesMetaRequestBody,
    responses(
        (status = 200, description = "Updates the metadata for any number of files", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_files_metadata(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<UpdateFilesMetaRequestBody>,
) -> Json<ApiResponse<EmptyApiResponse>> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &req_body.file_ids,
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesMetaUpdate).unwrap(),
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

    match req_body.files_meta {
        UpdateFilesMetaType::Tags(tags_meta) => {
            match app_state
                .db
                .update_files_tags(
                    &req_body.file_ids,
                    &tags_meta.tags,
                    &tags_meta.method,
                    &requesting_user.id,
                )
                .await
            {
                Ok(_) => {}
                Err(e) => {
                    return Json(ApiResponse {
                        status: ApiResponseStatus::Error,
                        message: format!("Failed to update file tags: {}", e),
                        data: None,
                    });
                }
            }
        }
    };

    return Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Updated Files metadata".to_string(),
        data: None,
    });
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFilesMetaRequestBody {
    pub file_ids: Vec<Uuid>,
    pub files_meta: UpdateFilesMetaType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesMetaType {
    Tags(UpdateFilesMetaTypeTags),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFilesMetaTypeTags {
    pub tags: HashMap<String, String>,
    pub method: UpdateFilesMetaTypeTagsMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesMetaTypeTagsMethod {
    Add,
    Remove,
    Set,
}
