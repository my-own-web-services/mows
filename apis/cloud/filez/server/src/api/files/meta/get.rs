use std::collections::HashMap;

use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    models::{AccessPolicyAction, AccessPolicyResourceType, File},
    types::{ApiResponse, ApiResponseStatus, AppState},
};

#[utoipa::path(
    post,
    path = "/api/files/meta/get",
    request_body = GetFilesMetaRequestBody,
    responses(
        (status = 200, description = "Gets the metadata for any number of files", body = ApiResponse<GetFileMetaResBody>),
    )
)]
pub async fn get_files_metadata(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &req_body.file_ids,
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesMetaGet).unwrap(),
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

    let files_meta_result = match app_state.db.get_files_metadata(&req_body.file_ids).await {
        Ok(files_meta) => files_meta,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get files metadata: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.get_files_metadata".to_string(),
        Some("Database operation to get files metadata".to_string()),
    );

    let file_tags = match app_state.db.get_files_tags(&req_body.file_ids).await {
        Ok(tags) => tags,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get file tags: {}", e),
                data: None,
            });
        }
    };

    let mut files_meta: HashMap<Uuid, FileMeta> = HashMap::new();

    for requested_file_id in &req_body.file_ids {
        let file_meta = files_meta_result
            .get(requested_file_id)
            .cloned()
            .map(|file| {
                let tags = file_tags
                    .get(requested_file_id)
                    .cloned()
                    .unwrap_or_default();
                FileMeta { file, tags }
            });

        if let Some(meta) = file_meta {
            files_meta.insert(*requested_file_id, meta);
        } else {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("File with ID {} not found", requested_file_id),
                data: None,
            });
        }
    }

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
    pub files_meta: HashMap<Uuid, FileMeta>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct FileMeta {
    pub file: File,
    pub tags: HashMap<String, String>,
}
