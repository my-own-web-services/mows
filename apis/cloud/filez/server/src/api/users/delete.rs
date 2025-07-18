use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/delete",
    request_body = DeleteUserRequestBody,
    responses(
        (status = 200, description = "Deletes a User", body = ApiResponse<DeleteUserResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_user(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteUserRequestBody>,
) -> Result<Json<ApiResponse<DeleteUserResponseBody>>, FilezError> {
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

    let user_id = match request_body.method {
        DeleteUserMethod::ById(id) => id,
        DeleteUserMethod::ByExternalId(external_id) => {
            FilezUser::get_by_external_id(&db, &external_id).await?.id
        }
        DeleteUserMethod::ByEmail(email) => FilezUser::get_by_email(&db, &email).await?.id,
    };

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::User,
            Some(&[user_id]),
            AccessPolicyAction::UsersDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );
    with_timing!(
        FilezUser::delete(&db, &user_id).await?,
        "Database operation to delete user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User deleted successfully".to_string(),
        data: Some(DeleteUserResponseBody { user_id }),
    }))
}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteUserRequestBody {
    pub method: DeleteUserMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum DeleteUserMethod {
    ById(Uuid),
    ByExternalId(String),
    ByEmail(String),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteUserResponseBody {
    pub user_id: Uuid,
}
