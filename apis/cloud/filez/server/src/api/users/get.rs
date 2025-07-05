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
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/get",
    request_body = GetUsersReqBody,
    responses(
        (status = 200, description = "Gets Users", body = ApiResponse<GetUsersResBody>),
    )
)]
pub async fn get_users(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<GetUsersReqBody>,
) -> Result<Json<ApiResponse<GetUsersResBody>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_by_external_id(&db, &external_user.user_id).await?,
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
            Some(&req_body.user_ids),
            &serde_variant::to_variant_name(&AccessPolicyAction::UsersGet).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let users = with_timing!(
        FilezUser::get_many_by_id(&db, &req_body.user_ids).await?,
        "Database operation to get users by IDs",
        timing
    );

    let mut users_meta = HashMap::new();

    for requested_user_id in &req_body.user_ids {
        if let Some(user) = users.get(requested_user_id) {
            users_meta.insert(*requested_user_id, UserMeta { user: user.clone() });
        } else {
            return Err(FilezError::ResourceNotFound(format!(
                "User with ID {} not found",
                requested_user_id
            )));
        }
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Successfully retrieved users".to_string(),
        data: Some(GetUsersResBody { users_meta }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetUsersReqBody {
    pub user_ids: Vec<Uuid>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetUsersResBody {
    pub users_meta: HashMap<Uuid, UserMeta>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UserMeta {
    pub user: FilezUser,
}
