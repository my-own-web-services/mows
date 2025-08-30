use crate::{config::config, models::users::FilezUserType, validation::Json};
use axum::{extract::State, Extension};
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};

#[utoipa::path(
    post,
    path = "/api/dev/reset_database",
    description = "Resets the database to its initial state (for development purposes only)",
    request_body = DevResetDatabaseRequestBody,
    responses(
        (
            status = 200,
            description = "Database reset successfully",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 401,
            description = "Unauthorized - SuperAdmin access required",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 403,
            description = "Forbidden - Dev mode must be enabled to use this endpoint",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database), level = "trace")]
pub async fn reset_database(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Json(request_body): Json<DevResetDatabaseRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let server_config = get_current_config_cloned!(config());

    if !server_config.enable_dev {
        return Err(FilezError::Forbidden(
            "Dev mode must be enabled to use this endpoint".to_string(),
        ));
    }

    if authentication_information.requesting_user.is_none()
        || authentication_information
            .requesting_user
            .as_ref()
            .unwrap()
            .user_type
            != FilezUserType::SuperAdmin
    {
        return Err(FilezError::Unauthorized(
            "SuperAdmin access required".to_string(),
        ));
    }

    database.dev_full_reset().await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Database reset".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct DevResetDatabaseRequestBody {}
