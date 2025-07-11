use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/create",
    request_body = CreateUserRequestBody,
    responses(
        (status = 200, description = "Creates a User", body = ApiResponse<CreateUserResponseBody>),
    )
)]
pub async fn create_user(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateUserRequestBody>,
) -> Result<Json<ApiResponse<CreateUserResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::User).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::UsersCreate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );
    let new_user = with_timing!(
        FilezUser::create(&db, &request_body.email, &requesting_user.id).await?,
        "Database operation to create user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
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
