use super::{AccessPolicyAction, AccessPolicyResourceType};
use crate::errors::FilezError;
use crate::filter_subject_access_policies;
use crate::models::access_policies::{AccessPolicy, Effect, SubjectType};
use crate::models::apps::MowsApp;
use crate::models::user_groups::UserGroupId;
use crate::models::users::{FilezUser, FilezUserId, FilezUserType};
use crate::{database::Database, schema};
use diesel::{
    pg::sql_types, prelude::*, BoolExpressionMethods, ExpressionMethods, SelectableHelper,
};
use diesel::{PgArrayExpressionMethods, QueryDsl};
use diesel_async::RunQueryDsl;
use mows_auth_core::ResourceTypeRegistry;
use std::collections::{HashMap, HashSet};
use tracing::trace;
use uuid::Uuid;

#[tracing::instrument(skip(database), level = "trace")]
pub async fn check_resources_access_control(
    database: &Database,
    maybe_requesting_user: Option<&FilezUser>,
    maybe_user_group_ids: Option<&Vec<UserGroupId>>,
    context_app: &MowsApp,
    resource_type: AccessPolicyResourceType,
    maybe_requested_resource_ids: Option<&[uuid::Uuid]>,
    action_to_perform: AccessPolicyAction,
) -> Result<AuthResult, FilezError> {
    let mut connection = database.get_connection().await?;
    // Engine-registry lookup. Safe to .expect — the registry was
    // populated from these very enum values at startup; absence here
    // would be a programmer error, not user input.
    let resource_auth_info = engine_resource_registry()
        .lookup(resource_type as u32)
        .expect("resource type registered in engine registry");

    if let Some(requesting_user) = maybe_requesting_user {
        if requesting_user.user_type == FilezUserType::SuperAdmin {
            trace!(
                user_id = %requesting_user.id,
                resource_type = ?resource_type,
                action = ?action_to_perform,
                "SuperAdmin user {} is requesting access to resource type {:?} with action {:?}",
                requesting_user.id,
                resource_type,
                action_to_perform
            );
            return Ok(AuthResult {
                access_granted: true,
                evaluations: match maybe_requested_resource_ids {
                    Some(ids) => ids
                        .iter()
                        .map(|&id| AuthEvaluation {
                            resource_id: Some(id),
                            is_allowed: true,
                            reason: AuthReason::SuperAdmin,
                        })
                        .collect(),
                    None => vec![AuthEvaluation {
                        resource_id: None,
                        is_allowed: true,
                        reason: AuthReason::SuperAdmin,
                    }],
                },
            });
        }
    }

    match maybe_requested_resource_ids {
        Some(requested_resource_ids) => {
            if requested_resource_ids.is_empty() {
                trace!(
                    "No resource IDs provided for access control check for resource type {:?}",
                    resource_type
                );
                return Err(FilezError::AuthEvaluationError(
                    "No resource IDs provided for access control check".to_string(),
                ));
            };

            let owners_map: HashMap<uuid::Uuid, FilezUserId> = if let Some(owner_col) =
                resource_auth_info.resource_table_owner_column
            {
                // 1. Fetch Owner Information for all requested resources
                let owners_query_string = format!(
                    "SELECT {id_col} as resource_id, {owner_col} as owner_id FROM {table_name} WHERE {id_col} = ANY($1)",
                    table_name = resource_auth_info.resource_table,
                    id_col = resource_auth_info.resource_table_id_column,
                    owner_col = owner_col
                );

                let resource_owners_vec: Vec<ResourceOwnerInfo> =
                    diesel::sql_query(&owners_query_string)
                        .bind::<sql_types::Array<sql_types::Uuid>, _>(requested_resource_ids)
                        .load::<ResourceOwnerInfo>(&mut connection)
                        .await?;

                trace!(
                    resource_type = ?resource_type,
                    requested_resource_ids = ?requested_resource_ids,
                    "Fetched resource owners for resource type {:?}: {:?}",
                    resource_type,
                    resource_owners_vec
                );

                // if the app is trusted and all requested resources are owned by the requesting user, return early

                let all_resources_owned_by_requesting_user = maybe_requesting_user
                    .map(|user| resource_owners_vec.iter().all(|r| r.owner_id == user.id))
                    .unwrap_or(false);

                if context_app.trusted
                    && resource_owners_vec.len() == requested_resource_ids.len()
                    && all_resources_owned_by_requesting_user
                {
                    trace!("All requested resources are owned by the requesting user and app is trusted. Granting access.");
                    return Ok(AuthResult {
                        access_granted: true,
                        evaluations: requested_resource_ids
                            .iter()
                            .map(|&id| AuthEvaluation {
                                resource_id: Some(id),
                                is_allowed: true,
                                reason: AuthReason::Owned,
                            })
                            .collect(),
                    });
                } else {
                    trace!(
                        context_app_trusted = context_app.trusted,
                        resource_type = ?resource_type,
                        requested_resource_ids = ?requested_resource_ids,
                        resource_owners_vec = ?resource_owners_vec,
                        all_resources_owned_by_requesting_user = all_resources_owned_by_requesting_user,
                        "Not all requested resources are owned by the requesting user or app is not trusted. Continuing with access control check."
                    );
                }

                resource_owners_vec
                    .into_iter()
                    .map(|r| (r.resource_id, r.owner_id))
                    .collect()
            } else {
                trace!(
                    "No owner column defined for resource type {:?}. Assuming no ownership check is needed.",
                    resource_type
                );
                HashMap::new()
            };

            // 2. Fetch relevant Access Policies (Direct on Resource)

            let direct_policies = schema::access_policies::table
                .filter(schema::access_policies::resource_id.eq_any(requested_resource_ids))
                .filter(
                    schema::access_policies::resource_type.eq(&resource_type),
                )
                .filter(schema::access_policies::context_app_ids.contains(vec![context_app.id]))
                .filter(schema::access_policies::actions.contains(vec![action_to_perform]))
                .filter(filter_subject_access_policies!(
                    maybe_requesting_user,
                    maybe_user_group_ids
                ))
                .select(AccessPolicy::as_select())
                .load::<AccessPolicy>(&mut connection)
                .await?;

            trace!(
                resource_type = ?resource_type,
                direct_policies = ?direct_policies,
                "Fetched direct access policies for resource type {:?}: {:?}",
                resource_type,
                direct_policies
            );

            let mut direct_policies_map: HashMap<uuid::Uuid, Vec<AccessPolicy>> = HashMap::new();
            for policy in direct_policies {
                direct_policies_map
                    .entry(policy.resource_id.ok_or(FilezError::AuthEvaluationError(
                        "Direct policy missing resource_id".to_string(),
                    ))?)
                    .or_default()
                    .push(policy);
            }

            // 3. Fetch Resource Group Memberships and their Policies (if applicable)

            let mut resource_group_policies_map: HashMap<uuid::Uuid, Vec<AccessPolicy>> =
                HashMap::new();
            let mut resource_group_memberships_map: HashMap<uuid::Uuid, Vec<uuid::Uuid>> =
                HashMap::new();
            let mut relevant_resource_group_ids: HashSet<uuid::Uuid> = HashSet::new();

            if let (
                Some(group_membership_table),
                Some(group_membership_table_resource_id_column),
                Some(group_membership_table_group_id_column),
                Some(resource_group_type_u32),
            ) = (
                resource_auth_info.group_membership_table,
                resource_auth_info.group_membership_resource_id_column,
                resource_auth_info.group_membership_group_id_column,
                resource_auth_info.resource_group_type,
            ) {
                // Engine returns u32; convert back to typed enum for the
                // diesel SmallInt-bound filter below. Safe to .expect —
                // the registry was populated from the same enum at startup.
                let resource_group_type_policy_str =
                    AccessPolicyResourceType::from_u32(resource_group_type_u32)
                        .expect("resource_group_type registered in engine registry");
                let resource_group_memberships_query_string = format!(
            "SELECT {resource_id_column} as resource_id, {group_id_column} as group_id FROM {table_name} WHERE {resource_id_column} = ANY($1)",
            table_name = group_membership_table,
            resource_id_column = group_membership_table_resource_id_column,
            group_id_column = group_membership_table_group_id_column
        );

                let resource_group_memberships: Vec<ResourceGroupMembership> =
                    diesel::sql_query(&resource_group_memberships_query_string)
                        .bind::<diesel::sql_types::Array<diesel::sql_types::Uuid>, _>(
                            requested_resource_ids,
                        )
                        .load(&mut connection)
                        .await?;

                for m in resource_group_memberships {
                    resource_group_memberships_map
                        .entry(m.resource_id)
                        .or_default()
                        .push(m.group_id);
                    relevant_resource_group_ids.insert(m.group_id);
                }

                if !relevant_resource_group_ids.is_empty() {
                    let resource_group_policies = schema::access_policies::table
                        .filter(
                            schema::access_policies::resource_id
                                .eq_any(&relevant_resource_group_ids),
                        )
                        .filter(
                            schema::access_policies::resource_type
                                .eq(resource_group_type_policy_str),
                        )
                        .filter(
                            schema::access_policies::context_app_ids.contains(vec![context_app.id]),
                        )
                        .filter(schema::access_policies::actions.contains(vec![action_to_perform]))
                        .filter(filter_subject_access_policies!(
                            maybe_requesting_user,
                            maybe_user_group_ids
                        ))
                        .select(AccessPolicy::as_select())
                        .load::<AccessPolicy>(&mut connection)
                        .await?;

                    for policy in resource_group_policies {
                        resource_group_policies_map
                            .entry(policy.resource_id.ok_or(FilezError::AuthEvaluationError(
                                "Resource group policy missing resource_id".to_string(),
                            ))?)
                            .or_default()
                            .push(policy);
                    }
                }
            }

            // 4. Evaluate for each requested resource ID
            let mut auth_evaluations: Vec<AuthEvaluation> = Vec::new();

            for resource_id in requested_resource_ids {
                let mut current_evaluation = AuthEvaluation {
                    resource_id: Some(*resource_id),
                    is_allowed: false,
                    reason: AuthReason::NoMatchingAllowPolicy,
                };

                // A. Check if resource exists (based on owner fetch)
                if !owners_map.contains_key(resource_id) {
                    current_evaluation.reason = AuthReason::ResourceNotFound;
                    auth_evaluations.push(current_evaluation);
                    continue;
                }

                // Policy Precedence: DENY rules take priority
                let mut denied = false;

                // Check direct DENY policies.
                if let Some(policies) = direct_policies_map.get(resource_id) {
                    for policy in policies {
                        if policy.effect == Effect::Deny {
                            denied = true;
                            current_evaluation.is_allowed = false;
                            current_evaluation.reason = deny_reason_direct(policy);
                            break;
                        }
                    }
                }
                if denied {
                    auth_evaluations.push(current_evaluation);
                    continue;
                }

                // Check Resource Group DENY policies
                if let Some(member_of_resource_group_ids) =
                    resource_group_memberships_map.get(resource_id)
                {
                    for resource_group_id in member_of_resource_group_ids {
                        if let Some(policies) = resource_group_policies_map.get(&resource_group_id)
                        {
                            for policy in policies {
                                if policy.effect == Effect::Deny {
                                    denied = true;
                                    current_evaluation.is_allowed = false;
                                    current_evaluation.reason = deny_reason_via_resource_group(
                                        policy,
                                        *resource_group_id,
                                    );
                                    break;
                                }
                            }
                        }
                        if denied {
                            break;
                        }
                    }
                };
                if denied {
                    auth_evaluations.push(current_evaluation);
                    continue;
                }

                // --- If not denied, check for ALLOW ---

                // B. Check Ownership

                if let Some(requesting_user) = maybe_requesting_user {
                    if let Some(owner_id) = owners_map.get(resource_id) {
                        if *owner_id == requesting_user.id {
                            current_evaluation.is_allowed = true;
                            current_evaluation.reason = AuthReason::Owned;
                            auth_evaluations.push(current_evaluation);
                            continue;
                        }
                    }
                }

                // C. Check direct ALLOW policies
                let mut allowed_by_direct = false;
                if let Some(policies) = direct_policies_map.get(resource_id) {
                    for policy in policies {
                        if policy.effect == Effect::Allow {
                            allowed_by_direct = true;
                            current_evaluation.is_allowed = true;
                            current_evaluation.reason = match policy.subject_type {
                                SubjectType::User => {
                                    AuthReason::AllowedByDirectUserPolicy {
                                        policy_id: policy.id.0.into(),
                                    }
                                }
                                SubjectType::UserGroup => {
                                    AuthReason::AllowedByDirectUserGroupPolicy {
                                        policy_id: policy.id.0.into(),
                                        via_user_group_id: policy.subject_id.0.into(),
                                    }
                                }
                                SubjectType::Public => {
                                    AuthReason::AllowedByPubliclyAccessible {
                                        policy_id: policy.id.0.into(),
                                    }
                                }
                                SubjectType::ServerMember => {
                                    AuthReason::AllowedByServerAccessible {
                                        policy_id: policy.id.0.into(),
                                    }
                                }
                            };
                            break;
                        }
                    }
                }
                if allowed_by_direct {
                    auth_evaluations.push(current_evaluation);
                    continue;
                }

                // D. Check resource group ALLOW policies
                let mut allowed_by_resource_group = false;
                if let Some(member_of_rg_ids) = resource_group_memberships_map.get(resource_id) {
                    for rg_id in member_of_rg_ids {
                        if let Some(policies) = resource_group_policies_map.get(rg_id) {
                            for policy in policies {
                                // DENY handled above
                                if policy.effect == Effect::Allow {
                                    allowed_by_resource_group = true;
                                    current_evaluation.is_allowed = true;
                                    current_evaluation.reason = match policy.subject_type {
                                        SubjectType::User => {
                                            AuthReason::AllowedByResourceGroupUserPolicy {
                                                policy_id: policy.id.0.into(),
                                                on_resource_group_id: *rg_id,
                                            }
                                        }
                                        SubjectType::UserGroup => {
                                            AuthReason::AllowedByResourceGroupUserGroupPolicy {
                                                policy_id: policy.id.0.into(),
                                                via_user_group_id: policy.subject_id.0.into(),
                                                on_resource_group_id: *rg_id,
                                            }
                                        }
                                        SubjectType::Public => {
                                            AuthReason::AllowedByPubliclyAccessible {
                                                policy_id: policy.id.0.into(),
                                            }
                                        }
                                        SubjectType::ServerMember => {
                                            AuthReason::AllowedByServerAccessible {
                                                policy_id: policy.id.0.into(),
                                            }
                                        }
                                    };
                                    break;
                                }
                            }
                        }
                        if allowed_by_resource_group {
                            break;
                        }
                    }
                }

                // If no specific rule granted access, it remains denied by default.
                auth_evaluations.push(current_evaluation);
            }

            let access_granted = auth_evaluations.iter().all(|eval| eval.is_allowed);

            Ok(AuthResult {
                access_granted,
                evaluations: auth_evaluations,
            })
        }
        None => {
            let type_level_policies = schema::access_policies::table
                .filter(schema::access_policies::resource_id.is_null())
                .filter(
                    schema::access_policies::resource_type.eq(&resource_type),
                )
                .filter(schema::access_policies::context_app_ids.contains(vec![context_app.id]))
                .filter(schema::access_policies::actions.contains(vec![action_to_perform]))
                .filter(filter_subject_access_policies!(
                    maybe_requesting_user,
                    maybe_user_group_ids
                ))
                .select(AccessPolicy::as_select())
                .load::<AccessPolicy>(&mut connection)
                .await?;

            if let Some(deny_policy) = type_level_policies
                .iter()
                .find(|p| p.effect == Effect::Deny)
            {
                let evaluation = AuthEvaluation {
                    resource_id: None,
                    is_allowed: false,
                    reason: match deny_policy.subject_type {
                        SubjectType::User => AuthReason::DeniedByDirectUserPolicy {
                            policy_id: deny_policy.id.0.into(),
                        },
                        SubjectType::UserGroup => {
                            AuthReason::DeniedByDirectUserGroupPolicy {
                                policy_id: deny_policy.id.0.into(),
                                via_user_group_id: deny_policy.subject_id.0.into(),
                            }
                        }
                        SubjectType::Public => AuthReason::DeniedByPubliclyAccessible {
                            policy_id: deny_policy.id.0.into(),
                        },
                        SubjectType::ServerMember => {
                            AuthReason::DeniedByServerAccessible {
                                policy_id: deny_policy.id.0.into(),
                            }
                        }
                    },
                };
                return Ok(AuthResult {
                    access_granted: false,
                    evaluations: vec![evaluation],
                });
            }

            if let Some(allow_policy) = type_level_policies
                .iter()
                .find(|p| p.effect == Effect::Allow)
            {
                let evaluation = AuthEvaluation {
                    resource_id: None,
                    is_allowed: true,
                    reason: match allow_policy.subject_type {
                        SubjectType::User => AuthReason::AllowedByDirectUserPolicy {
                            policy_id: allow_policy.id.0.into(),
                        },
                        SubjectType::UserGroup => {
                            AuthReason::AllowedByDirectUserGroupPolicy {
                                policy_id: allow_policy.id.0.into(),
                                via_user_group_id: allow_policy.subject_id.0.into(),
                            }
                        }
                        SubjectType::Public => {
                            AuthReason::AllowedByPubliclyAccessible {
                                policy_id: allow_policy.id.0.into(),
                            }
                        }
                        SubjectType::ServerMember => {
                            AuthReason::AllowedByServerAccessible {
                                policy_id: allow_policy.id.0.into(),
                            }
                        }
                    },
                };
                return Ok(AuthResult {
                    access_granted: true,
                    evaluations: vec![evaluation],
                });
            }

            let evaluation = AuthEvaluation {
                resource_id: None,
                is_allowed: false,
                reason: AuthReason::NoMatchingAllowPolicy,
            };
            Ok(AuthResult {
                access_granted: false,
                evaluations: vec![evaluation],
            })
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
struct ResourceOwnerInfo {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    owner_id: FilezUserId,
}

// Helper struct to hold fetched resource group memberships
#[derive(QueryableByName, Debug, Clone)]
struct ResourceGroupMembership {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    group_id: Uuid,
}

// AuthReason and AuthEvaluation are engine-owned (mows_auth_core::evaluation).
// Re-exported under their short names so the existing function bodies below
// can keep using `AuthReason::Variant` and `AuthEvaluation { … }` literals
// without a deep import path. These are NOT aliases of a local type — they
// are the engine's canonical types.
pub use mows_auth_core::{AuthEvaluation, AuthReason};

// Filez's local ResourceAuthInfo struct + get_auth_params_for_resource_type
// function were deleted in Cleanup-5. The 9 resource-type entries live
// inline in `engine_resource_registry()` below and are looked up via
// the engine's StaticResourceTypeRegistry trait — single source of
// truth, SQL-identifier validation at boot, no parallel data.

// AuthResult is engine-owned. Re-exported here so existing call sites
// keep their short import path. `verify()` and `verify_allow_type_level()`
// live as an extension trait on the engine type — see
// `crate::errors::AuthResultExt`.
pub use mows_auth_core::AuthResult;

/// Convert filez's `(Option<&FilezUser>, Option<&Vec<UserGroupId>>)`
/// pair — the exact shape `check_resources_access_control` accepts
/// today — into the engine's `Subject`. Used at the boundary when
/// filez handlers call into mows-auth-core: filez resolves group
/// memberships, builds the Subject, then hands it to the engine.
///
/// `is_super_admin` is set from filez's `FilezUserType::SuperAdmin`
/// so the engine's super-admin shortcut fires without filez having
/// to special-case it before the call.
pub fn subject_from_filez(
    user: Option<&FilezUser>,
    groups: Option<&Vec<UserGroupId>>,
) -> mows_auth_core::Subject {
    match user {
        None => mows_auth_core::Subject::Anonymous,
        Some(u) => mows_auth_core::Subject::User {
            user_id: u.id.0.into(),
            groups: groups
                .map(|gs| gs.iter().map(|g| g.0.into()).collect())
                .unwrap_or_default(),
            is_super_admin: u.user_type == FilezUserType::SuperAdmin,
        },
    }
}

/// Map a directly-applied DENY policy to its `AuthReason`. Extracted
/// from the inline match in `check_resources_access_control` so the
/// reason mapping is unit-testable (see `tests::deny_reason_*`).
///
/// Public / ServerMember subjects MUST map to `DeniedBy*`, not
/// `AllowedBy*`. The pre-fix code at this site silently collapsed
/// them, corrupting the audit log on the hottest denial path
/// (Public resource with overriding Deny).
fn deny_reason_direct(policy: &AccessPolicy) -> AuthReason {
    match policy.subject_type {
        SubjectType::User => AuthReason::DeniedByDirectUserPolicy {
            policy_id: policy.id.0.into(),
        },
        SubjectType::UserGroup => AuthReason::DeniedByDirectUserGroupPolicy {
            policy_id: policy.id.0.into(),
            via_user_group_id: policy.subject_id.0.into(),
        },
        SubjectType::Public => AuthReason::DeniedByPubliclyAccessible {
            policy_id: policy.id.0.into(),
        },
        SubjectType::ServerMember => AuthReason::DeniedByServerAccessible {
            policy_id: policy.id.0.into(),
        },
    }
}

/// Map a resource-group-attached DENY policy to its `AuthReason`.
/// Same bug class as `deny_reason_direct` — Public / ServerMember
/// subjects MUST map to `DeniedBy*`.
fn deny_reason_via_resource_group(policy: &AccessPolicy, resource_group_id: Uuid) -> AuthReason {
    match policy.subject_type {
        SubjectType::User => AuthReason::DeniedByResourceGroupUserPolicy {
            policy_id: policy.id.0.into(),
            on_resource_group_id: resource_group_id,
        },
        SubjectType::UserGroup => AuthReason::DeniedByResourceGroupUserGroupPolicy {
            policy_id: policy.id.0.into(),
            via_user_group_id: policy.subject_id.0.into(),
            on_resource_group_id: resource_group_id,
        },
        SubjectType::Public => AuthReason::DeniedByPubliclyAccessible {
            policy_id: policy.id.0.into(),
        },
        SubjectType::ServerMember => AuthReason::DeniedByServerAccessible {
            policy_id: policy.id.0.into(),
        },
    }
}

#[cfg(test)]
mod tests {
    //! Regression guards for the Deny-reason mapping bug. The pre-fix
    //! code mapped Public / ServerMember Deny outcomes to
    //! `AllowedByPubliclyAccessible` / `AllowedByServerAccessible` —
    //! audit log said "allowed" when the request was actually denied.
    //! Every variant is asserted explicitly so a future refactor that
    //! flips a single arm fails one of these tests.
    use super::*;
    use crate::models::access_policies::{
        AccessPolicyAction, AccessPolicyId, AccessPolicyResourceType, AccessPolicySubjectId,
    };
    use crate::models::apps::MowsAppId;
    use chrono::NaiveDateTime;
    use uuid::Uuid;

    fn policy(
        subject_type: SubjectType,
        effect: Effect,
    ) -> AccessPolicy {
        AccessPolicy {
            id: AccessPolicyId::nil(),
            name: "test".to_string(),
            owner_id: FilezUserId::nil(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            subject_type,
            subject_id: AccessPolicySubjectId::nil(),
            context_app_ids: vec![MowsAppId::nil()],
            resource_type: AccessPolicyResourceType::File,
            resource_id: None,
            actions: vec![AccessPolicyAction::FilezFilesGet],
            effect,
        }
    }

    #[test]
    fn deny_reason_direct_public_does_not_become_allowed() {
        let reason = deny_reason_direct(&policy(
            SubjectType::Public,
            Effect::Deny,
        ));
        // The pre-fix bug produced `AllowedByPubliclyAccessible` here.
        assert!(
            matches!(reason, AuthReason::DeniedByPubliclyAccessible { .. }),
            "Public+Deny direct must map to DeniedByPubliclyAccessible, got {reason:?}"
        );
    }

    #[test]
    fn deny_reason_direct_server_member_does_not_become_allowed() {
        let reason = deny_reason_direct(&policy(
            SubjectType::ServerMember,
            Effect::Deny,
        ));
        // The pre-fix bug produced `AllowedByServerAccessible` here.
        assert!(
            matches!(reason, AuthReason::DeniedByServerAccessible { .. }),
            "ServerMember+Deny direct must map to DeniedByServerAccessible, got {reason:?}"
        );
    }

    #[test]
    fn deny_reason_direct_user_and_user_group_unchanged() {
        // Sanity: the User and UserGroup cases were never buggy; assert
        // they still produce the right Denied variants.
        let user = deny_reason_direct(&policy(
            SubjectType::User,
            Effect::Deny,
        ));
        assert!(matches!(user, AuthReason::DeniedByDirectUserPolicy { .. }));
        let group = deny_reason_direct(&policy(
            SubjectType::UserGroup,
            Effect::Deny,
        ));
        assert!(matches!(group, AuthReason::DeniedByDirectUserGroupPolicy { .. }));
    }

    #[test]
    fn deny_reason_via_resource_group_public_does_not_become_allowed() {
        let resource_group_id = Uuid::new_v4();
        let reason = deny_reason_via_resource_group(
            &policy(SubjectType::Public, Effect::Deny),
            resource_group_id,
        );
        assert!(
            matches!(reason, AuthReason::DeniedByPubliclyAccessible { .. }),
            "Public+Deny via-resource-group must map to DeniedByPubliclyAccessible, got {reason:?}"
        );
    }

    #[test]
    fn deny_reason_via_resource_group_server_member_does_not_become_allowed() {
        let resource_group_id = Uuid::new_v4();
        let reason = deny_reason_via_resource_group(
            &policy(SubjectType::ServerMember, Effect::Deny),
            resource_group_id,
        );
        assert!(
            matches!(reason, AuthReason::DeniedByServerAccessible { .. }),
            "ServerMember+Deny via-resource-group must map to DeniedByServerAccessible, got {reason:?}"
        );
    }

    #[test]
    fn deny_reason_via_resource_group_carries_resource_group_id_for_user_variants() {
        let rg = Uuid::new_v4();
        let user = deny_reason_via_resource_group(
            &policy(SubjectType::User, Effect::Deny),
            rg,
        );
        match user {
            AuthReason::DeniedByResourceGroupUserPolicy {
                on_resource_group_id, ..
            } => assert_eq!(on_resource_group_id, rg),
            other => panic!("User+Deny via-rg wrong variant: {other:?}"),
        }
        let group = deny_reason_via_resource_group(
            &policy(SubjectType::UserGroup, Effect::Deny),
            rg,
        );
        match group {
            AuthReason::DeniedByResourceGroupUserGroupPolicy {
                on_resource_group_id, ..
            } => assert_eq!(on_resource_group_id, rg),
            other => panic!("UserGroup+Deny via-rg wrong variant: {other:?}"),
        }
    }
}

/// Build a `mows_auth_core::StaticResourceTypeRegistry` from the same
/// data filez's local `get_auth_params_for_resource_type` returns.
/// Today this only delivers boot-time SQL-identifier-injection
/// validation — when `check_access` moves to the engine it becomes the
/// canonical source and the local function disappears.
///
/// The registry is built once via `OnceLock`; if any identifier fails
/// validation, the process panics at first access. That's correct:
/// the alternative is letting a service boot with a bad table name
/// that would later get spliced into `EXECUTE format()` SQL.
pub fn engine_resource_registry() -> &'static mows_auth_core::StaticResourceTypeRegistry {
    static REGISTRY: std::sync::OnceLock<mows_auth_core::StaticResourceTypeRegistry> =
        std::sync::OnceLock::new();
    REGISTRY.get_or_init(|| {
        // 9 inline entries. Adding a 10th means: extend
        // `AccessPolicyResourceType` (with explicit discriminant) and
        // its `from_u32` match arm in mod.rs, add an entry here, and
        // — if you want SQL-identifier injection coverage from day 1
        // — the registry_validation test below will exercise the
        // lookup path.
        let file = mows_auth_core::ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::File as u32,
            group_membership_table: Some("file_file_group_members"),
            group_membership_resource_id_column: Some("file_id"),
            group_membership_group_id_column: Some("file_group_id"),
            resource_group_type: Some(AccessPolicyResourceType::FileGroup as u32),
        };
        let plain = |rt: AccessPolicyResourceType, table: &'static str, owner_col: Option<&'static str>| {
            mows_auth_core::ResourceAuthInfo {
                resource_table: table,
                resource_table_id_column: "id",
                resource_table_owner_column: owner_col,
                resource_type: rt as u32,
                group_membership_table: None,
                group_membership_resource_id_column: None,
                group_membership_group_id_column: None,
                resource_group_type: None,
            }
        };
        let entries = vec![
            file,
            plain(AccessPolicyResourceType::FileGroup, "file_groups", Some("owner_id")),
            plain(AccessPolicyResourceType::User, "users", Some("id")),
            plain(AccessPolicyResourceType::UserGroup, "user_groups", Some("owner_id")),
            plain(AccessPolicyResourceType::StorageLocation, "storage_locations", None),
            plain(AccessPolicyResourceType::AccessPolicy, "access_policies", Some("owner_id")),
            plain(AccessPolicyResourceType::StorageQuota, "storage_quotas", Some("owner_id")),
            plain(AccessPolicyResourceType::FilezJob, "jobs", Some("owner_id")),
            plain(AccessPolicyResourceType::MowsApp, "apps", None),
        ];
        mows_auth_core::StaticResourceTypeRegistry::new(entries)
            .expect("filez resource registry has unsafe SQL identifiers — see RegistryError")
    })
}

#[cfg(test)]
mod registry_validation {
    //! Boot-time guard: filez's 9 resource types must construct a
    //! valid engine registry. If anyone introduces a new
    //! AccessPolicyResourceType with a bad identifier (e.g.
    //! "files-table" or a quoted-identifier shape) the test fails
    //! before the binary ships.
    use super::engine_resource_registry;
    use crate::models::access_policies::AccessPolicyResourceType;
    use mows_auth_core::ResourceTypeRegistry;

    #[test]
    fn filez_registry_builds_without_unsafe_identifiers() {
        let reg = engine_resource_registry();
        // Spot-check the 9 expected entries are present.
        assert!(reg.lookup(AccessPolicyResourceType::File as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::FileGroup as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::User as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::UserGroup as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::StorageLocation as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::AccessPolicy as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::StorageQuota as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::FilezJob as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::MowsApp as u32).is_some());
        assert_eq!(reg.all().len(), 9, "expected all 9 filez resource types");
        // Lookup of an unregistered integer must return None — guards
        // against silent default-allow if an Action references a
        // type-int that hasn't been registered.
        assert!(reg.lookup(999).is_none());
    }

    #[test]
    fn file_entry_has_correct_group_membership_wiring() {
        let reg = engine_resource_registry();
        let file = reg
            .lookup(AccessPolicyResourceType::File as u32)
            .expect("File registered");
        assert_eq!(file.resource_table, "files");
        assert_eq!(file.resource_table_owner_column, Some("owner_id"));
        assert_eq!(file.group_membership_table, Some("file_file_group_members"));
        assert_eq!(file.resource_group_type, Some(AccessPolicyResourceType::FileGroup as u32));
    }
}

#[cfg(test)]
mod boundary_helpers {
    //! Tests for the filez↔engine boundary helpers. The
    //! AuthReason/AuthEvaluation/AuthResult roundtrip tests that used
    //! to live here are gone — those types ARE the engine types now,
    //! no roundtrip to test. What remains:
    //!   * subject_from_filez (3 cases — anonymous, regular user,
    //!     SuperAdmin) — the only filez-specific conversion left.
    //!   * AccessPolicy → PolicyView preserves all 4 ids (the only
    //!     compile-check-resistant drift target).
    use super::*;
    use crate::models::access_policies::AccessPolicyId;
    use crate::models::user_groups::UserGroupId;
    use uuid::Uuid;

    #[test]
    fn subject_from_filez_anonymous() {
        let s = super::subject_from_filez(None, None);
        assert_eq!(s, mows_auth_core::Subject::Anonymous);
    }

    #[test]
    fn subject_from_filez_user_with_groups() {
        use crate::models::users::FilezUserType;
        use chrono::NaiveDateTime;
        let user_uuid = Uuid::new_v4();
        let group_uuid = Uuid::new_v4();
        let user = FilezUser {
            id: crate::models::users::FilezUserId(user_uuid.into()),
            external_user_id: Some("sub-abc".to_string()),
            pre_identifier_email: None,
            display_name: "Test".to_string(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            deleted: false,
            profile_picture: None,
            created_by: None,
            user_type: FilezUserType::Regular,
            idp_id: mows_auth_core::ZITADEL_IDP_ID,
        };
        let groups = vec![UserGroupId(group_uuid.into())];
        let s = super::subject_from_filez(Some(&user), Some(&groups));
        match s {
            mows_auth_core::Subject::User {
                user_id,
                groups,
                is_super_admin,
            } => {
                assert_eq!(user_id, user_uuid);
                assert_eq!(groups, vec![group_uuid]);
                assert!(
                    !is_super_admin,
                    "Regular user must NOT be promoted to SuperAdmin"
                );
            }
            other => panic!("expected Subject::User, got {other:?}"),
        }
    }

    #[test]
    fn subject_from_filez_super_admin_sets_flag() {
        use crate::models::users::FilezUserType;
        use chrono::NaiveDateTime;
        let user = FilezUser {
            id: crate::models::users::FilezUserId(Uuid::new_v4().into()),
            external_user_id: None,
            pre_identifier_email: None,
            display_name: "Admin".to_string(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            deleted: false,
            profile_picture: None,
            created_by: None,
            user_type: FilezUserType::SuperAdmin,
            idp_id: mows_auth_core::ZITADEL_IDP_ID,
        };
        let s = super::subject_from_filez(Some(&user), None);
        match s {
            mows_auth_core::Subject::User { is_super_admin, groups, .. } => {
                assert!(is_super_admin, "SuperAdmin user must set the flag");
                assert!(groups.is_empty(), "None groups must yield empty Vec");
            }
            other => panic!("expected Subject::User, got {other:?}"),
        }
    }

    #[test]
    fn access_policy_to_policy_view_preserves_ids() {
        use crate::models::access_policies::AccessPolicy;
        use crate::models::access_policies::{AccessPolicyAction, AccessPolicyResourceType};
        use crate::models::apps::MowsAppId;
        use chrono::NaiveDateTime;
        let policy_uuid = Uuid::new_v4();
        let subject_uuid = Uuid::new_v4();
        let policy = AccessPolicy {
            id: AccessPolicyId(policy_uuid.into()),
            name: "test".to_string(),
            owner_id: FilezUserId::nil(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            subject_type: SubjectType::UserGroup,
            subject_id: crate::models::access_policies::AccessPolicySubjectId(subject_uuid.into()),
            context_app_ids: vec![MowsAppId::nil()],
            resource_type: AccessPolicyResourceType::File,
            resource_id: None,
            actions: vec![AccessPolicyAction::FilezFilesGet],
            effect: Effect::Deny,
        };
        let view: mows_auth_core::PolicyView = (&policy).into();
        assert_eq!(view.id, policy_uuid);
        assert_eq!(view.subject_id, subject_uuid);
        assert_eq!(view.effect, mows_auth_core::types::Effect::Deny);
        assert_eq!(view.subject_type, mows_auth_core::types::SubjectType::UserGroup);
    }
}
