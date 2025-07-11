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
    path = "/api/users/delete",
    request_body = DeleteUserRequestBody,
    responses(
        (status = 200, description = "Deletes a User", body = ApiResponse<DeleteUserResponseBody>),
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

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::User).unwrap(),
            Some(&[request_body.user_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::UsersDelete).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );
    with_timing!(
        FilezUser::delete(&db, &request_body.user_id).await?,
        "Database operation to delete user",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User deleted successfully".to_string(),
        data: Some(DeleteUserResponseBody {
            user_id: request_body.user_id,
        }),
    }))
}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteUserRequestBody {
    pub user_id: Uuid,
}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteUserResponseBody {
    pub user_id: Uuid,
}
