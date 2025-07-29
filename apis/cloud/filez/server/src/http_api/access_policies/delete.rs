use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

#[utoipa::path(
    delete,
    path = "/api/access_policies/delete/{access_policy_id}",
    params(
        ("access_policy_id" = Uuid, Path, description = "The ID of the access policy to delete"),
    ),
    responses(
        (status = 200, description = "Deletes a access policy", body = ApiResponse<Uuid>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_access_policy(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Uuid>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![access_policy_id]),
            AccessPolicyAction::AccessPoliciesDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        AccessPolicy::delete(&database, &access_policy_id).await?,
        "Database operation to delete access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policy deleted".to_string(),
        data: Some(access_policy_id),
    }))
}
