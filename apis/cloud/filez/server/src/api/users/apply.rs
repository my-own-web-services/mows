use crate::types::{ApiResponse, ApiResponseStatus, AppState};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/apply",
    responses(
        (status = 200, description = "Applied own user", body = ApiResponse<ApplyUserResponseBody>),
    )
)]
pub async fn apply_user(
    external_user: IntrospectedUser,
    State(app_state): State<AppState>,
) -> Json<ApiResponse<ApplyUserResponseBody>> {
    match app_state
        .db
        .apply_user(
            &external_user.user_id,
            &external_user.preferred_username.unwrap_or("".to_string()),
        )
        .await
    {
        Ok(user_id) => Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "User applied successfully".to_string(),
            data: Some(ApplyUserResponseBody { user_id }),
        }),
        Err(e) => Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: format!("Failed to apply user: {}", e),
            data: None,
        }),
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApplyUserResponseBody {
    pub user_id: Uuid,
}
