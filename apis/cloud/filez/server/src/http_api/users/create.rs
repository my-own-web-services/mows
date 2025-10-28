use crate::validation::Json;
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
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/users/create",
    description = "Create a new user in the database",
    request_body = CreateUserRequestBody,
    responses(
        (
            status = 200,
            description = "Created the User",
            body = ApiResponse<CreateUserResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_user(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateUserRequestBody>,
) -> Result<Json<ApiResponse<CreateUserResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::User,
            None,
            AccessPolicyAction::UsersCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let created_user = with_timing!(
        FilezUser::create_one(
            &database,
            &request_body.email,
            &authentication_information.requesting_user.unwrap().id
        )
        .await?,
        "Database operation to create user",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User created successfully".to_string(),
        data: Some(CreateUserResponseBody { created_user }),
    }))
}
#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct CreateUserRequestBody {
    pub email: String,
}
#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct CreateUserResponseBody {
    pub created_user: FilezUser,
}
