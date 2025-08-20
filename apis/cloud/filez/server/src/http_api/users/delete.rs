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
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;


#[utoipa::path(
    post,
    path = "/api/users/delete",
    request_body = DeleteUserRequestBody,
    responses(
        (status = 200, description = "Deletes a User", body = ApiResponse<DeleteUserResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]

pub async fn delete_user(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteUserRequestBody>,
) -> Result<Json<ApiResponse<DeleteUserResponseBody>>, FilezError> {
    let user_id = match request_body.method {
        DeleteUserMethod::ById(id) => id,
        DeleteUserMethod::ByExternalId(external_id) => {
            FilezUser::get_by_external_id(&database, &external_id)
                .await?
                .id
        }
        DeleteUserMethod::ByEmail(email) => FilezUser::get_by_email(&database, &email).await?.id,
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
        FilezUser::delete(&database, &user_id).await?,
        "Database operation to delete user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User deleted successfully".to_string(),
        data: Some(DeleteUserResponseBody { user_id }),
    }))
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DeleteUserRequestBody {
    pub method: DeleteUserMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum DeleteUserMethod {
    ById(FilezUserId),
    ByExternalId(String),
    ByEmail(String),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DeleteUserResponseBody {
    pub user_id: FilezUserId,
}
