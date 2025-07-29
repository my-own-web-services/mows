use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::users::FilezUser,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};
use axum::{Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/users/get_own",
    responses(
        (status = 200, description = "Got own user", body = ApiResponse<GetOwnUserBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_own_user(
    Extension(AuthenticationInformation {
        requesting_user, ..
    }): Extension<AuthenticationInformation>,
) -> Result<Json<ApiResponse<GetOwnUserBody>>, FilezError> {
    let requesting_user = requesting_user
        .ok_or_else(|| FilezError::Unauthorized("User not authenticated".to_string()))?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Got own user".to_string(),
        data: Some(GetOwnUserBody {
            user: requesting_user,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetOwnUserBody {
    pub user: FilezUser,
}
