use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
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
    get,
    path = "/api/user_groups/{user_group_id}",
    responses(
        (status = 200, description = "Gets a user group by ID", body = ApiResponse<UserGroup>),
    )
)]
pub async fn get_user_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
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
            &serde_variant::to_variant_name(&AccessPolicyAction::UserGroupRead).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let user_group = with_timing!(
        UserGroup::get_by_id(&db, &user_group_id).await?,
        "Database operation to get user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group retrieved".to_string(),
        data: Some(user_group),
    }))
}
