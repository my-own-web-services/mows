use crate::{
    errors::FilezError,
    http_api::authentication_middleware::AuthenticationInformation,
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
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/users/get",
    request_body = GetUsersReqBody,
    responses(
        (status = 200, description = "Gets Users", body = ApiResponse<GetUsersResBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_users(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetUsersReqBody>,
) -> Result<Json<ApiResponse<GetUsersResBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::User,
            Some(&request_body.user_ids),
            AccessPolicyAction::UsersGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let users = with_timing!(
        FilezUser::get_many_by_id(&database, &request_body.user_ids).await?,
        "Database operation to get users by IDs",
        timing
    );

    let mut users_meta = HashMap::new();

    for requested_user_id in &request_body.user_ids {
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
