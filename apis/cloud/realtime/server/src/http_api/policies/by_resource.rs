//! `POST /api/access_policies/by_resource` — sibling of /explain.
//!
//! Answers the inverse question: given a single `(resource_type,
//! resource_id)`, list every policy that pins access to it, plus the
//! resource's owner for context. Backs the cross-service authz admin
//! UI's "Who can see X?" panel (Phase 7 of the authorization
//! initiative — see `.plans/authorization/PLAN.md`).
//!
//! Authorization: the caller must own the resource. This matches the
//! create_policy gate ("only the channel owner may share it") and
//! keeps the diagnostic surface aligned with the share surface — if
//! you can grant access, you can audit it. Looser visibility (e.g.
//! "any user with Allow on the resource may inspect") is deferred
//! until a ServerAdmin / shared-with-me audit surface lands.
//!
//! Existence + ownership are collapsed into a single 403 so a
//! non-owner cannot probe UUID space to enumerate which resource
//! ids exist — same defence the engine applies for the "no matching
//! Allow" case (POLICY_SEMANTICS.md §3 step 5). A 404 would leak
//! that signal.
//!
//! Wire shape: shared with the future filez sibling so the
//! `authz-admin` BFF stays a translator-free forwarder, same as the
//! /explain pair after review-1 R4.

use axum::{extract::State, Extension, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyResourceType},
        channels::ChannelId,
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ByResourceRequest {
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Uuid,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ByResourceResponse {
    /// `Some(user_id)` for resources with an owner column (Channel,
    /// User, AccessPolicy); reserved as `None` for future
    /// owner-less types (e.g. MowsApp) that may reach this surface.
    /// Matches the filez sibling's nullability contract verbatim
    /// (review R15) — both ship `Some` today, both ship `None`
    /// only when an owner-less type lands. The admin UI renders
    /// this as a synthetic "Owner" row above the policies list,
    /// since owners get implicit access without a policy entry.
    pub resource_owner_id: Option<Uuid>,
    /// Every non-revoked, non-expired access policy whose Allow/Deny
    /// landing affects access to the requested resource:
    ///   - Single-scope policies pinned to this `resource_id`
    ///   - Type-level policies (`resource_id IS NULL`) on this
    ///     `resource_type` (grants/denies access to all resources
    ///     of the type)
    ///   - OwnedByOwner-scope policies on this `resource_type`
    ///     where `policy.owner_id == resource.owner_id` (the
    ///     "share everything I own" pattern; see
    ///     POLICY_SEMANTICS.md §4)
    ///
    /// Realtime today does not ship resource-groups (no
    /// Channel-group concept), so resource-group-via policies are
    /// omitted. The filez sibling adds them on its side.
    pub policies: Vec<AccessPolicy>,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/by_resource",
    description = "Returns every policy that pins access to one resource, plus the resource's owner. Backs the admin UI's 'Who can see X?' panel. Caller must own the resource.",
    request_body = ByResourceRequest,
    responses(
        (status = 200, description = "Owner + policies", body = ApiResponse<ByResourceResponse>),
        (status = 401, description = "Anonymous request"),
        (status = 403, description = "Resource does not exist OR caller is not its owner — the two cases are deliberately indistinguishable to prevent UUID-space fingerprinting"),
    )
)]
pub async fn by_resource(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<ByResourceRequest>,
) -> Result<Json<ApiResponse<ByResourceResponse>>, RealtimeError> {
    let caller = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let mut connection = state.database.get_connection().await?;

    // Existence + ownership + policy fetch all run inside one
    // diesel-async transaction so the policy filter for OwnedByOwner
    // sees the same `resource_owner_id` the gate checked. Without
    // the transaction, a concurrent owner-transfer between the two
    // queries would let the panel render policies filtered by the
    // stale owner — review R1.
    //
    // Existence + ownership are collapsed into one 403 so a
    // non-owner cannot probe UUID space to enumerate which channel
    // ids exist — the same defence the engine applies elsewhere by
    // mapping "no matching Allow" to Denied (POLICY_SEMANTICS.md
    // §3 step 5). A 404 would leak that information.
    //
    // MVP scope: only Channel is user-shareable in realtime today,
    // so it's the only branch with a meaningful query. Other
    // resource types refuse with the SAME 403 response (so
    // "unsupported type" can't be distinguished from "you don't own
    // this channel" from the caller's perspective).
    let caller_id = caller.id;
    let resource_id_uuid = body.resource_id;
    let resource_type = body.resource_type;

    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncConnection;
    let (resource_owner_id, policies) = connection
        .transaction(|conn| {
            async move {
                let resource_owner_id: Uuid = match resource_type {
                    AccessPolicyResourceType::Channel => {
                        let owner_row = schema::channels::table
                            .filter(schema::channels::id.eq(ChannelId(resource_id_uuid)))
                            .filter(schema::channels::owner_id.eq(caller_id))
                            .select(schema::channels::owner_id)
                            .first::<crate::models::users::UserId>(conn)
                            .await
                            .optional()?;
                        match owner_row {
                            Some(owner) => owner.0,
                            None => {
                                return Err(RealtimeError::Forbidden(
                                    "no such resource, or caller is not its owner".to_string(),
                                ));
                            }
                        }
                    }
                    AccessPolicyResourceType::User
                    | AccessPolicyResourceType::AccessPolicy
                    | AccessPolicyResourceType::MowsApp => {
                        return Err(RealtimeError::Forbidden(
                            "no such resource, or caller is not its owner".to_string(),
                        ));
                    }
                };

                // Pull every relevant policy in one query: direct +
                // type-level + OwnedByOwner-scoped where the policy's
                // owner matches the resource's owner. `revoked =
                // false` + expiration filtering matches what the
                // engine applies in check_access so the panel doesn't
                // render dead rows (review R4).
                let now = chrono::Utc::now().naive_utc();
                let policies = schema::access_policies::table
                    .filter(schema::access_policies::resource_type.eq(resource_type))
                    .filter(schema::access_policies::revoked.eq(false))
                    .filter(
                        schema::access_policies::expires_at
                            .is_null()
                            .or(schema::access_policies::expires_at.gt(now)),
                    )
                    .filter(
                        // Single + this resource_id  OR  type-level
                        // (NULL)  OR  OwnedByOwner whose
                        // policy.owner_id == resource.owner_id
                        schema::access_policies::resource_id
                            .eq(Some(resource_id_uuid))
                            .or(schema::access_policies::resource_id.is_null())
                            .or(schema::access_policies::owner_id
                                .eq(crate::models::users::UserId(resource_owner_id))
                                .and(
                                    schema::access_policies::resource_scope
                                        .eq(mows_auth_core::types::ResourceScope::OwnedByOwner),
                                )),
                    )
                    .order_by(schema::access_policies::created_time.desc())
                    .select(AccessPolicy::as_select())
                    .load::<AccessPolicy>(conn)
                    .await?;
                Ok::<_, RealtimeError>((resource_owner_id, policies))
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} policy(ies)", policies.len()),
        data: Some(ByResourceResponse {
            resource_owner_id: Some(resource_owner_id),
            policies,
        }),
    }))
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the (resource_type, resource_id) → {resource_owner_id,
    //! policies} wire shape so the `authz-admin` BFF can stay a
    //! no-translator forwarder. See `explain.rs::wire_shape_guard`
    //! for the same pattern.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_uses_shared_field_names() {
        let parsed: ByResourceRequest = serde_json::from_value(json!({
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000001",
        }))
        .expect("must accept the canonical (resource_type, resource_id) shape");
        let back = serde_json::to_value(&parsed).expect("round-trip");
        assert_eq!(back["resource_type"], "Channel");
        assert_eq!(
            back["resource_id"],
            "00000000-0000-0000-0000-000000000001"
        );
    }

    #[test]
    fn response_body_uses_shared_field_names() {
        let body = ByResourceResponse {
            resource_owner_id: Some(Uuid::nil()),
            policies: vec![],
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("resource_owner_id").is_some());
        assert!(serialised.get("policies").is_some());
        // Guard against accidental rename drift to a filez-style
        // prefix; the BFF forwards verbatim and the SPA reads
        // these exact keys.
        assert!(serialised.get("access_policies").is_none());
        assert!(serialised.get("owner").is_none());
    }
}
