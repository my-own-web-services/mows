use axum::{extract::State, Extension, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use mows_auth_core::types::{Effect, SubjectType};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyResourceType,
        },
        apps::MowsAppId,
        channels::ChannelId,
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Deserialize, ToSchema, Debug)]
pub struct CreatePolicyRequest {
    pub name: String,
    pub subject_type: SubjectType,
    /// Nil-UUID for `Public` / `ServerMember`; user_id or
    /// user_group_id for `User` / `UserGroup`.
    pub subject_id: Uuid,
    pub resource_type: AccessPolicyResourceType,
    /// `Some(id)` for Single-scope; `None` for type-level.
    pub resource_id: Option<Uuid>,
    pub actions: Vec<AccessPolicyAction>,
    pub effect: Effect,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct CreatePolicyResponse {
    pub policy: AccessPolicy,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/create",
    description = "Create a new access policy owned by the caller. The caller must be authenticated; v1 does not gate WHO can write policies (production hardening would).",
    request_body = CreatePolicyRequest,
    responses(
        (status = 200, description = "Policy created", body = ApiResponse<CreatePolicyResponse>),
        (status = 401, description = "Anonymous request"),
        (status = 400, description = "Body validation failed"),
    )
)]
pub async fn create_policy(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<CreatePolicyRequest>,
) -> Result<Json<ApiResponse<CreatePolicyResponse>>, RealtimeError> {
    let owner = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let name = body.name.trim();
    if name.is_empty() || name.len() > 256 {
        return Err(RealtimeError::BadRequest(
            "policy name must be 1-256 characters".to_string(),
        ));
    }
    if body.actions.is_empty() {
        return Err(RealtimeError::BadRequest(
            "policy must grant at least one action".to_string(),
        ));
    }

    // Authorize: the caller must own the resource they're
    // creating a policy for. Without this gate, any authenticated
    // user could grant themselves access to anyone's channel
    // (review A2 / SECURITY-1 / ARCH-5).
    //
    // For Single-scope policies (`resource_id = Some(id)`), check
    // ownership directly. For type-level policies
    // (`resource_id = None`), only the chat MowsApp itself
    // (system bootstrap) creates them today; user-initiated
    // type-level policies are refused.
    match (body.resource_type, body.resource_id) {
        (AccessPolicyResourceType::Channel, Some(channel_id)) => {
            let mut connection = state.database.get_connection().await?;
            let row_count: i64 = schema::channels::table
                .filter(schema::channels::id.eq(ChannelId(channel_id)))
                .filter(schema::channels::owner_id.eq(owner.id))
                .count()
                .get_result::<i64>(&mut connection)
                .await?;
            if row_count == 0 {
                return Err(RealtimeError::Forbidden(
                    "only the channel owner may share it".to_string(),
                ));
            }
        }
        (AccessPolicyResourceType::Channel, None) => {
            return Err(RealtimeError::Forbidden(
                "type-level Channel policies are not user-creatable in chat v1"
                    .to_string(),
            ));
        }
        _ => {
            return Err(RealtimeError::BadRequest(format!(
                "chat v1 only supports Channel-targeted policies; got {:?}",
                body.resource_type
            )));
        }
    }

    let policy = AccessPolicy::create_one(
        &state.database,
        name,
        owner.id,
        body.subject_type,
        body.subject_id,
        vec![MowsAppId(auth.context_app.id.0)],
        body.resource_type,
        body.resource_id,
        body.actions,
        body.effect,
    )
    .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "policy created".to_string(),
        data: Some(CreatePolicyResponse { policy }),
    }))
}
