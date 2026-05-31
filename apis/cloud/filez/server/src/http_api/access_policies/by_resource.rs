//! `POST /api/access_policies/by_resource` — sibling of /explain.
//!
//! For a single `(resource_type, resource_id)`, return every policy
//! pinning access to it plus the resource's owner. Backs the
//! cross-service authz admin UI's "Who can see X?" panel (Phase 7 of
//! the authorization initiative — see `.plans/authorization/PLAN.md`).
//!
//! Wire shape: identical to realtime-server's sibling endpoint so the
//! `authz-admin` BFF stays a translator-free forwarder. Diff vs.
//! realtime: filez ships resource-groups (file_file_group_members),
//! so for `File` we additionally surface policies pinned to any group
//! the file belongs to. Realtime has no group-membership table for
//! Channels and only returns direct + type-level + owner-scoped rows.
//!
//! Authorization: the caller must own the resource. Existence and
//! ownership are deliberately collapsed into one 403 so a non-owner
//! cannot probe UUID space to enumerate which resource ids exist —
//! mirrors POLICY_SEMANTICS.md §3 step 5 "no matching Allow ⇒ Denied".

use axum::{extract::State, Extension};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyResourceType},
        files::FilezFileId,
        file_groups::FileGroupId,
        users::FilezUserId,
    },
    schema,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::Json,
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/by_resource",
    request_body = ByResourceRequestBody,
    description = "Returns every policy pinning access to one resource, plus the resource's owner. Sibling of realtime-server's endpoint; both emit the same shape so the authz-admin BFF stays translator-free. Caller must own the resource; non-existence and non-ownership are collapsed into one 403.",
    responses(
        (
            status = 200,
            description = "Owner + policies",
            body = ApiResponse<ByResourceResponseBody>
        ),
        (
            status = 401,
            description = "Anonymous request"
        ),
        (
            status = 403,
            description = "Resource does not exist OR caller is not its owner — deliberately indistinguishable"
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn by_resource(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ByResourceRequestBody>,
) -> Result<Json<ApiResponse<ByResourceResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| FilezError::Unauthorized("authentication required".to_string()))?;

    let mut connection = database.get_connection().await?;

    // Existence + ownership + policy fetch all run inside one
    // diesel-async transaction so the OwnedByOwner filter sees the
    // same `resource_owner_id` the gate checked. Without the
    // transaction a concurrent owner-transfer between queries
    // would let the panel render policies filtered by the stale
    // owner — review R1.
    //
    // The owner check filters on caller's id so a non-owner can't
    // tell "doesn't exist" apart from "exists but not yours" —
    // both come back empty here and trip the same 403. The
    // caller-scoped query also uses the per-table owner_id index.
    let caller_id = caller.id;
    let resource_type = request_body.resource_type;
    let resource_id_uuid = request_body.resource_id;

    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncConnection;
    let (resource_owner_id, policies) = with_timing!(
        connection
            .transaction::<_, FilezError, _>(|conn| {
                async move {
                    let resource_owner_id: Uuid = match resource_type {
                        AccessPolicyResourceType::File => {
                            let row = schema::files::table
                                .filter(schema::files::id.eq(FilezFileId(resource_id_uuid)))
                                .filter(schema::files::owner_id.eq(caller_id))
                                .select(schema::files::owner_id)
                                .first::<FilezUserId>(conn)
                                .await
                                .optional()?;
                            match row {
                                Some(owner) => owner.0,
                                None => {
                                    return Err(FilezError::Forbidden(
                                        "no such resource, or caller is not its owner"
                                            .to_string(),
                                    ));
                                }
                            }
                        }
                        AccessPolicyResourceType::FileGroup => {
                            let row = schema::file_groups::table
                                .filter(
                                    schema::file_groups::id.eq(FileGroupId(resource_id_uuid)),
                                )
                                .filter(schema::file_groups::owner_id.eq(caller_id))
                                .select(schema::file_groups::owner_id)
                                .first::<FilezUserId>(conn)
                                .await
                                .optional()?;
                            match row {
                                Some(owner) => owner.0,
                                None => {
                                    return Err(FilezError::Forbidden(
                                        "no such resource, or caller is not its owner"
                                            .to_string(),
                                    ));
                                }
                            }
                        }
                        _ => {
                            // Other ownable resource types (User /
                            // UserGroup / StorageQuota /
                            // StorageLocation / FilezJob /
                            // AccessPolicy / MowsApp) are not
                            // user-shareable through the share-dialog
                            // flow. Same 403 response keeps the
                            // surface uniform.
                            return Err(FilezError::Forbidden(
                                "no such resource, or caller is not its owner".to_string(),
                            ));
                        }
                    };

                    // Pull policies pinning this resource:
                    //   1. Direct (Single scope) on resource_id
                    //   2. Type-level (resource_id IS NULL)
                    //   3. OwnedByOwner whose policy.owner_id
                    //      matches resource.owner_id
                    //   4. For File: FileGroup-pinned via
                    //      file_file_group_members (added below)
                    //
                    // Filtered for revoked = false + non-expired,
                    // mirroring the engine's check_access filter so
                    // the panel doesn't render dead rows (review R4).
                    let now = chrono::Utc::now().naive_utc();
                    let mut policies: Vec<AccessPolicy> = schema::access_policies::table
                        .filter(schema::access_policies::resource_type.eq(resource_type))
                        .filter(schema::access_policies::revoked.eq(false))
                        .filter(
                            schema::access_policies::expires_at
                                .is_null()
                                .or(schema::access_policies::expires_at.gt(now)),
                        )
                        .filter(
                            schema::access_policies::resource_id
                                .eq(Some(resource_id_uuid))
                                .or(schema::access_policies::resource_id.is_null())
                                .or(schema::access_policies::owner_id
                                    .eq(FilezUserId(resource_owner_id))
                                    .and(
                                        schema::access_policies::resource_scope.eq(
                                            mows_auth_core::types::ResourceScope::OwnedByOwner,
                                        ),
                                    )),
                        )
                        .order_by(schema::access_policies::created_time.desc())
                        .select(AccessPolicy::as_select())
                        .load::<AccessPolicy>(conn)
                        .await?;

                    // For File: also surface group-mediated policies.
                    // A file with zero memberships skips the second
                    // query and returns only direct/type/owner-scoped
                    // policies — that's correct (the file is reachable
                    // through its direct grants only). Review R12.
                    if let AccessPolicyResourceType::File = resource_type {
                        let group_ids: Vec<Uuid> = schema::file_file_group_members::table
                            .filter(
                                schema::file_file_group_members::file_id
                                    .eq(FilezFileId(resource_id_uuid)),
                            )
                            .select(schema::file_file_group_members::file_group_id)
                            .load::<Uuid>(conn)
                            .await?;
                        if !group_ids.is_empty() {
                            // diesel's eq_any lifts the borrowed
                            // Vec<Uuid> into the Nullable<Uuid>
                            // column on its own — no need to wrap
                            // each id in Some manually (review R8).
                            let group_policies: Vec<AccessPolicy> =
                                schema::access_policies::table
                                    .filter(
                                        schema::access_policies::resource_type
                                            .eq(AccessPolicyResourceType::FileGroup),
                                    )
                                    .filter(
                                        schema::access_policies::resource_id.eq_any(&group_ids),
                                    )
                                    .filter(schema::access_policies::revoked.eq(false))
                                    .filter(
                                        schema::access_policies::expires_at
                                            .is_null()
                                            .or(schema::access_policies::expires_at.gt(now)),
                                    )
                                    .order_by(schema::access_policies::created_time.desc())
                                    .select(AccessPolicy::as_select())
                                    .load::<AccessPolicy>(conn)
                                    .await?;
                            policies.extend(group_policies);
                        }
                    }

                    Ok((resource_owner_id, policies))
                }
                .scope_boxed()
            })
            .await?,
        "by_resource: snapshot owner + policies in one transaction",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: format!("{} policy(ies)", policies.len()),
        data: Some(ByResourceResponseBody {
            resource_owner_id: Some(resource_owner_id),
            policies,
        }),
    }))
}

/// Wire shape matches realtime-server's by_resource endpoint exactly
/// (`resource_type` / `resource_id` / `resource_owner_id` /
/// `policies`) so the cross-service admin BFF
/// (`apis/cloud/authz-admin/`) doesn't need to translate between
/// consumers. Drift here forces a per-upstream adapter back into
/// the BFF and surfaces as silent empty panels — the same class of
/// bug the /explain wire_shape_guard tests pin.
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ByResourceRequestBody {
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Uuid,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ByResourceResponseBody {
    /// `Some(user_id)` for resources with an owner column (File,
    /// FileGroup); reserved as `None` for future owner-less
    /// resource types that may reach this surface. Matches the
    /// realtime sibling's nullability contract verbatim (review
    /// R15) — both ship `Some` today, both ship `None` only when
    /// an owner-less type lands.
    pub resource_owner_id: Option<Uuid>,
    pub policies: Vec<AccessPolicy>,
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the (resource_type, resource_id) → {resource_owner_id,
    //! policies} wire shape. The authz-admin BFF forwards bytes
    //! verbatim; a rename here would silently empty the SPA panel
    //! (same class of bug the explain wire_shape_guard catches).
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_uses_shared_field_names() {
        let parsed: ByResourceRequestBody = serde_json::from_value(json!({
            "resource_type": "File",
            "resource_id": "00000000-0000-0000-0000-000000000001",
        }))
        .expect("must accept the canonical (resource_type, resource_id) shape");
        let back = serde_json::to_value(&parsed).expect("round-trip");
        assert_eq!(back["resource_type"], "File");
        assert_eq!(
            back["resource_id"],
            "00000000-0000-0000-0000-000000000001"
        );
        assert!(
            back.get("access_policy_resource_type").is_none(),
            "the pre-R4 prefix must not reappear here either"
        );
    }

    #[test]
    fn response_body_uses_shared_field_names() {
        let body = ByResourceResponseBody {
            resource_owner_id: Some(Uuid::nil()),
            policies: vec![],
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("resource_owner_id").is_some());
        assert!(serialised.get("policies").is_some());
        assert!(
            serialised.get("access_policies").is_none(),
            "must serialise as `policies`, not `access_policies`"
        );
    }
}
