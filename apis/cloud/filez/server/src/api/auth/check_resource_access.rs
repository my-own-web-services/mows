use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    auth::check::AuthEvaluation,
    types::{ApiResponse, ApiResponseStatus, AppState},
};

#[utoipa::path(
    post,
    path = "/api/auth/check",
    responses(
        (status = 200, description = "Checks if the requested resources are available to this user", body = ApiResponse<CheckResourceAccessResponseBody>),
    )
)]
pub async fn check_resource_access(
    external_user: IntrospectedUser,
    State(app_state): State<AppState>,
    Json(req_body): Json<CheckResourceAccessRequestBody>,
) -> Json<ApiResponse<CheckResourceAccessResponseBody>> {
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

    match app_state
        .db
        .check_resources_access_control(
            &requesting_user.id,
            &req_body.requesting_app_id.unwrap_or_default(),
            req_body.requesting_app_trusted.unwrap_or(false),
            &req_body.resource_type,
            &req_body.resource_ids,
            &req_body.action,
        )
        .await
    {
        Ok(auth_result) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Success,
                message: "Auth results retrieved".to_string(),
                data: Some(CheckResourceAccessResponseBody {
                    auth_evaluations: auth_result.1,
                }),
            });
        }
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Access control check failed: {}", e),
                data: None,
            });
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub resource_type: String,
    pub action: String,
    pub requesting_app_id: Option<Uuid>,
    pub requesting_app_trusted: Option<bool>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
