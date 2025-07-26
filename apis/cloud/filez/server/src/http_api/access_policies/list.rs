use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/list",
    request_body = ListAccessPoliciesRequestBody,
    responses(
        (status = 200, description = "Lists access policies", body = ApiResponse<ListAccessPoliciesResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_access_policies(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListAccessPoliciesRequestBody>,
) -> Result<Json<ApiResponse<ListAccessPoliciesResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::AccessPolicy,
            None,
            AccessPolicyAction::AccessPoliciesList,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policies = with_timing!(
        AccessPolicy::list_with_user_access(
            &database,
            &requesting_user.id,
            &requesting_app.id,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list access policies",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Access policies listed".to_string(),
        data: Some(ListAccessPoliciesResponseBody { access_policies }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListAccessPoliciesRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<ListAccessPoliciesSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListAccessPoliciesResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}
