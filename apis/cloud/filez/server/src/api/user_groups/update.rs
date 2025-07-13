use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
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
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/user_groups/{user_group_id}",
    request_body = UpdateUserGroupRequestBody,
    responses(
        (status = 200, description = "Updates a user group", body = ApiResponse<UserGroup>),
    )
)]
pub async fn update_user_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
    Json(req_body): Json<UpdateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<UserGroup>>, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::UserGroup).unwrap(),
            Some(&vec![user_group_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::UserGroupsUpdate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        UserGroup::update(&db, &user_group_id, &req_body.name).await?,
        "Database operation to update user group",
        timing
    );

    let user_group = with_timing!(
        UserGroup::get_by_id(&db, &user_group_id).await?,
        "Database operation to get updated user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group updated".to_string(),
        data: Some(user_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateUserGroupRequestBody {
    pub name: String,
}
