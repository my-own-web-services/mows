use std::collections::HashMap;

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    models::AccessPolicyResourceType,
    types::{ApiResponse, ApiResponseStatus, AppState, EmptyApiResponse},
};

#[utoipa::path(
    post,
    path = "/api/files/info/update",
    request_body = UpdateFilesInfoRequestBody,
    responses(
        (status = 200, description = "Updates the metadata for any number of files", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_files_metadata(
    external_user: IntrospectedUser,
    State(app_state): State<AppState>,
    Json(req_body): Json<UpdateFilesInfoRequestBody>,
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

    let requesting_app_id = Uuid::default();
    let requesting_app_trusted = false;

    let file_ids = req_body.file_ids;

    match app_state
        .db
        .check_resources_access_control(
            &requesting_user.id,
            &requesting_app_id,
            requesting_app_trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &file_ids,
            "files:update_info",
        )
        .await
    {
        Ok(auth_result) => {
            if !auth_result.0 {
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
        UpdateFilesInfoType::Tags(tags_info) => {
            match app_state
                .db
                .update_files_tags(
                    &file_ids,
                    &tags_info.tags,
                    &tags_info.method,
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
pub struct UpdateFilesInfoRequestBody {
    pub file_ids: Vec<Uuid>,
    pub files_meta: UpdateFilesInfoType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesInfoType {
    Tags(UpdateFilesInfoTypeTags),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFilesInfoTypeTags {
    pub tags: HashMap<String, String>,
    pub method: UpdateFilesInfoTypeTagsMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesInfoTypeTagsMethod {
    Add,
    Remove,
    Set,
}
