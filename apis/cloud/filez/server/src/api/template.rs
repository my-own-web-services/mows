use axum::{extract::State, Extension, Json};
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
    path = "/api/resource/get",
    request_body = ReqBody,
    responses(
        (status = 200, description = "", body = ApiResponse<ResBody>),
    )
)]
pub async fn get_resource(
    external_user: IntrospectedUser,
    State(AppState { db, .. }): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<ReqBody>,
) -> Json<ApiResponse<ResBody>> {
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
            "files:get_info",
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

    timing.lock().unwrap().record(
        "db.check_resources_access_control".to_string(),
        Some("Database operation to check access control".to_string()),
    );

    return Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "".to_string(),
        data: Some(ResBody {}),
    });
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ReqBody {}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ResBody {}
