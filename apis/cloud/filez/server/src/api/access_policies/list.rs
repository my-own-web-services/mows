use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/list",
    request_body = ListAccessPoliciesRequestBody,
    responses(
        (status = 200, description = "Lists access policies", body = ApiResponse<ListAccessPoliciesResponseBody>),
    )
)]
pub async fn list_access_policies(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListAccessPoliciesRequestBody>,
) -> Result<Json<ApiResponse<ListAccessPoliciesResponseBody>>, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::AccessPolicy).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::AccessPolicyList).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policies = with_timing!(
        AccessPolicy::list_with_user_access(
            &db,
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
