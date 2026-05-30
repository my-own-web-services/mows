use axum::{
    extract::{Path, State},
    Extension, Json,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::ChatError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{AccessPolicy, AccessPolicyId},
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, ToSchema, Debug)]
pub struct DeletePolicyResponse {
    pub deleted_id: Uuid,
}

#[utoipa::path(
    delete,
    path = "/api/access_policies/delete/{policy_id}",
    description = "Hard-delete an access policy the caller owns.",
    params(("policy_id" = Uuid, Path, description = "The policy id")),
    responses(
        (status = 200, description = "Deleted", body = ApiResponse<DeletePolicyResponse>),
        (status = 403, description = "Caller does not own this policy"),
        (status = 404, description = "Policy not found"),
    )
)]
pub async fn delete_policy(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(policy_id): Path<Uuid>,
) -> Result<Json<ApiResponse<DeletePolicyResponse>>, ChatError> {
    let owner = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| ChatError::Unauthorized("authentication required".to_string()))?;

    let mut connection = state.database.get_connection().await?;
    let existing: Option<AccessPolicy> = schema::access_policies::table
        .filter(schema::access_policies::id.eq(AccessPolicyId(policy_id)))
        .select(AccessPolicy::as_select())
        .first::<AccessPolicy>(&mut connection)
        .await
        .optional()?;
    let existing =
        existing.ok_or_else(|| ChatError::NotFound(format!("policy {policy_id}")))?;
    if existing.owner_id.0 != owner.id.0 {
        return Err(ChatError::Forbidden(
            "only the policy owner may delete it".to_string(),
        ));
    }

    diesel::delete(
        schema::access_policies::table
            .filter(schema::access_policies::id.eq(AccessPolicyId(policy_id))),
    )
    .execute(&mut connection)
    .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "policy deleted".to_string(),
        data: Some(DeletePolicyResponse { deleted_id: policy_id }),
    }))
}
