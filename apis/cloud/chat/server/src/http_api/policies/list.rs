use axum::{extract::State, Extension, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::ChatError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::AccessPolicy,
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListPoliciesResponse {
    pub policies: Vec<AccessPolicy>,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/list",
    description = "List every access policy owned by the caller. v1 is owner-scoped only; richer filters land later.",
    responses(
        (status = 200, description = "Policies", body = ApiResponse<ListPoliciesResponse>),
        (status = 401, description = "Anonymous request"),
    )
)]
pub async fn list_policies(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
) -> Result<Json<ApiResponse<ListPoliciesResponse>>, ChatError> {
    let owner = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| ChatError::Unauthorized("authentication required".to_string()))?;

    let mut connection = state.database.get_connection().await?;
    let policies = schema::access_policies::table
        .filter(schema::access_policies::owner_id.eq(owner.id))
        .filter(schema::access_policies::revoked.eq(false))
        .order_by(schema::access_policies::created_time.desc())
        .select(AccessPolicy::as_select())
        .load::<AccessPolicy>(&mut connection)
        .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} policy(ies)", policies.len()),
        data: Some(ListPoliciesResponse { policies }),
    }))
}
