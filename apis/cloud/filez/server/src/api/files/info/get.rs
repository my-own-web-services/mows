use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    models::{AccessPolicyResourceType, File},
    types::{ApiResponse, ApiResponseStatus, AppState},
};

#[utoipa::path(
    post,
    path = "/api/files/info/get",
    request_body = GetFilesMetaRequestBody,
    responses(
        (status = 200, description = "Gets the metadata for any number of files", body = ApiResponse<GetFileMetaResBody>),
    )
)]
pub async fn get_files_metadata(
    external_user: IntrospectedUser,
    State(app_state): State<AppState>,
    Json(req_body): Json<GetFilesMetaRequestBody>,
) -> Json<ApiResponse<GetFileMetaResBody>> {
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
            "files:get_metadata",
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

    let files_meta_result = match app_state
        .db
        .get_files_metadata_for_owner(&file_ids, requesting_user.id)
        .await
    {
        Ok(files_meta) => files_meta,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get files metadata: {}", e),
                data: None,
            });
        }
    };

    let files_meta: Vec<Option<File>> = file_ids
        .iter()
        .map(|fid| {
            files_meta_result
                .iter()
                .find(|file| file.id == *fid)
                .cloned()
        })
        .collect();

    return Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got Files metadata".to_string(),
        data: Some(GetFileMetaResBody { files_meta }),
    });
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesMetaRequestBody {
    pub file_ids: Vec<Uuid>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileMetaResBody {
    pub files_meta: Vec<Option<File>>,
}
