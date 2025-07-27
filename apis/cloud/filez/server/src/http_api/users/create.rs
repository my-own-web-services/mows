use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/users/create",
    request_body = CreateUserRequestBody,
    responses(
        (status = 200, description = "Creates a User", body = ApiResponse<CreateUserResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_user(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateUserRequestBody>,
) -> Result<Json<ApiResponse<CreateUserResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::User,
            None,
            AccessPolicyAction::UsersCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let new_user = with_timing!(
        FilezUser::create(&database, &request_body.email, &requesting_user.unwrap().id).await?,
        "Database operation to create user",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success{},
        message: "User created successfully".to_string(),
        data: Some(CreateUserResponseBody { id: new_user.id }),
    }))
}
#[derive(Deserialize, Serialize, ToSchema)]
pub struct CreateUserRequestBody {
    pub email: String,
}
#[derive(Deserialize, Serialize, ToSchema)]
pub struct CreateUserResponseBody {
    pub id: Uuid,
}
