use crate::{
    errors::FilezError,
    models::users::FilezUser,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/apply",
    responses(
        (status = 200, description = "Applied own user", body = ApiResponse<ApplyUserResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn apply_user(
    external_user: IntrospectedUser,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
) -> Result<Json<ApiResponse<ApplyUserResponseBody>>, FilezError> {
    let user = with_timing!(
        FilezUser::apply(&database, external_user).await?,
        "Database operation to apply user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User applied successfully".to_string(),
        data: Some(ApplyUserResponseBody { user }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApplyUserResponseBody {
    pub user: FilezUser,
}
