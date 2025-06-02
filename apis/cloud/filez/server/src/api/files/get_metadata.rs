use axum::{ Json,extract::State };
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
   models::File, types::{ApiResponse, ApiResponseStatus, AppState}
};

#[utoipa::path(
    post,    
    path = "/api/files/metadata/get",
    responses(
        (status = 200, description = "Gets the metadata for any number of files", body = ApiResponse<GetFileMetaResBody>),
    )
)]
pub async fn get_files_metadata(
    external_user: IntrospectedUser,
    State(app_state): State<AppState>,
    Json(req_body): Json<GetFilesMetaRequestBody>,
) -> Json<ApiResponse<GetFileMetaResBody>> {
    let user= match app_state
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

    let files_meta_result=match app_state.db.get_files_metadata_for_owner(&req_body.file_ids,user.user_id).await{
        Ok(files_meta) => files_meta,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get files metadata: {}", e),
                data: None,
            });
        }
    };
        
    let files_meta: Vec<Option<File>> = req_body
        .file_ids
        .iter()
        .map(|file_id| {
            files_meta_result
                .iter()
                .find(|file| file.file_id == *file_id)
                .cloned()
        })
        .collect();

    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got Files metadata".to_string(),
        data: Some(GetFileMetaResBody {
             files_meta,
        }),
    })
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesMetaRequestBody {
    pub file_ids: Vec<Uuid>,
}


#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileMetaResBody {
    pub files_meta: Vec<Option<File>>,
}


