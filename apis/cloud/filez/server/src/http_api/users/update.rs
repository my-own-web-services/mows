use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::FilezFileId,
        users::{FilezUser, FilezUserId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/users/update",
    request_body = UpdateUserRequestBody,
    responses(
        (status = 200, description = "Updates a user group", body = ApiResponse<FilezUser>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserRequestBody>,
) -> Result<Json<ApiResponse<UpdateUserResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_id.into()]),
            AccessPolicyAction::UserGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_user = with_timing!(
        FilezUser::update(
            &database,
            &request_body.user_id,
            request_body.profile_picture
        )
        .await?,
        "Database operation to update user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group updated".to_string(),
        data: Some(UpdateUserResponseBody { updated_user }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateUserRequestBody {
    pub user_id: FilezUserId,
    pub profile_picture: Option<FilezFileId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateUserResponseBody {
    pub updated_user: FilezUser,
}
