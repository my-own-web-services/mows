use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        user_groups::UserGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/update_members",
    request_body = UpdateUserGroupMembersRequestBody,
    responses(
        (status = 200, description = "Updates the members of a user group", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_user_group_members(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserGroupMembersRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
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
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id]),
            AccessPolicyAction::UserGroupsUpdateMembers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    if let Some(users_to_add) = request_body.users_to_add {
        with_timing!(
            UserGroup::add_users(&db, &request_body.user_group_id, &users_to_add).await?,
            "Database operation to add users to user group",
            timing
        );
    }

    if let Some(users_to_remove) = request_body.users_to_remove {
        with_timing!(
            UserGroup::remove_users(&db, &request_body.user_group_id, &users_to_remove).await?,
            "Database operation to remove users from user group",
            timing
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group members updated".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: Uuid,
    pub users_to_add: Option<Vec<Uuid>>,
    pub users_to_remove: Option<Vec<Uuid>>,
}
