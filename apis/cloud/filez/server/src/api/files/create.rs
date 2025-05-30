use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::types::{ApiResponse, ApiResponseStatus};

#[utoipa::path(
    post,
    path = "/create",
    responses(
        (status = 200, description = "Creates a file on the server", body = ApiResponse<GetFileResBody>),
    )
)]
pub async fn get_file() -> Json<ApiResponse<GetFileResBody>> {
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
