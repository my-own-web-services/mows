use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        users::{FilezUser, FilezUserId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/users/delete",
    description = "Delete a user from the database",
    request_body = DeleteUserRequestBody,
    responses(
        (
            status = 200,
            description = "Deleted the User",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_user(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteUserRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let user_id = match request_body.delete_user_method {
        DeleteUserMethod::ById(id) => id,
        DeleteUserMethod::ByExternalId(external_id) => {
            FilezUser::get_one_by_external_id(&database, &external_id)
                .await?
                .id
        }
        DeleteUserMethod::ByEmail(email) => {
            FilezUser::get_one_by_email(&database, &email).await?.id
        }
    };

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::User,
            Some(&[user_id.into()]),
            AccessPolicyAction::UsersDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );
    with_timing!(
        FilezUser::soft_delete_one(&database, &user_id).await?,
        "Database operation to delete user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User deleted successfully".to_string(),
        data: None,
    }))
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct DeleteUserRequestBody {
    pub delete_user_method: DeleteUserMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum DeleteUserMethod {
    ById(FilezUserId),
    ByExternalId(String),
    ByEmail(String),
}
