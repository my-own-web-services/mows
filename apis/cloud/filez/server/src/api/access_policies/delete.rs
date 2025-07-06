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
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    delete,
    path = "/api/access_policies/{access_policy_id}",
    responses(
        (status = 200, description = "Deletes a access policy", body = ApiResponse<String>),
    )
)]
pub async fn delete_access_policy(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<Uuid>,
) -> Result<Json<ApiResponse<String>>, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::AccessPolicy).unwrap(),
            Some(&vec![access_policy_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::AccessPolicyDelete).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        AccessPolicy::delete(&db, &access_policy_id).await?,
        "Database operation to delete access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Access policy deleted".to_string(),
        data: Some(access_policy_id.to_string()),
    }))
}
