use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::types::{ApiResponse, ApiResponseStatus};

#[utoipa::path(
    get,
    path = "/get",
    responses(
        (status = 200, description = "Got file", body = ApiResponse<GetFileResBody>),
    )
)]
pub async fn get_file(user: IntrospectedUser) -> Json<ApiResponse<GetFileResBody>> {
    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got File".to_string(),
        data: Some(GetFileResBody {
            file: format!(
                "Hello authorized user: {:?} with id {}",
                user.username, user.user_id
            ),
        }),
    })
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileResBody {
    pub file: String,
}
