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
use std::collections::HashMap;
use utoipa::ToSchema;


#[utoipa::path(
    post,
    path = "/api/users/get",
    request_body = GetUsersReqBody,
    responses(
        (status = 200, description = "Gets Users", body = ApiResponse<GetUsersResBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]

pub async fn get_users(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetUsersReqBody>,
) -> Result<Json<ApiResponse<GetUsersResBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::User,
            Some(
                &request_body
                    .user_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<_>>()
            ),
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
        status: ApiResponseStatus::Success {},
        message: "Successfully retrieved users".to_string(),
        data: Some(GetUsersResBody { users_meta }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetUsersReqBody {
    pub user_ids: Vec<FilezUserId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetUsersResBody {
    pub users_meta: HashMap<FilezUserId, UserMeta>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UserMeta {
    pub user: FilezUser,
}
