use crate::{
    errors::FilezErrors,
    types::{ApiResponse, ApiResponseStatus, AppState},
    with_timing,
};
use axum::{extract::State, Extension, Json};
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
    State(AppState { db, .. }): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
) -> Result<Json<ApiResponse<ApplyUserResponseBody>>, FilezErrors> {
    let user_id = with_timing!(
        db.apply_user(
            &external_user.user_id,
            &external_user.preferred_username.unwrap_or("".to_string()),
        )
        .await?,
        "Database operation to apply user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User applied successfully".to_string(),
        data: Some(ApplyUserResponseBody { user_id }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApplyUserResponseBody {
    pub user_id: Uuid,
}
