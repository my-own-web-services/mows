use super::{AccessPolicyAction, AccessPolicyResourceType};
use crate::errors::FilezError;
use crate::filter_subject_access_policies;
use crate::models::access_policies::{AccessPolicy, AccessPolicyEffect, AccessPolicySubjectType};
use crate::models::apps::MowsApp;
use crate::models::users::{FilezUser, FilezUserType};
use crate::{database::Database, schema};
use diesel::{
    pg::sql_types, prelude::*, BoolExpressionMethods, ExpressionMethods, SelectableHelper,
};
use diesel::{PgArrayExpressionMethods, QueryDsl};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;
use uuid::Uuid;

pub async fn check_resources_access_control(
    database: &Database,
    maybe_requesting_user: Option<&FilezUser>,
    maybe_user_group_ids: Option<&Vec<Uuid>>,
    context_app: &MowsApp,
    resource_type: AccessPolicyResourceType,
    requested_resource_ids: Option<&[Uuid]>,
    action_to_perform: AccessPolicyAction,
) -> Result<AuthResult, FilezError> {
    let mut connection = database.get_connection().await?;
    let resource_auth_info = get_auth_info(resource_type);

    if let Some(requesting_user) = maybe_requesting_user {
        if requesting_user.user_type == FilezUserType::SuperAdmin {
            return Ok(AuthResult {
                access_granted: true,
                evaluations: match requested_resource_ids {
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

    match requested_resource_ids {
        Some(requested_resource_ids) => {
            if requested_resource_ids.is_empty() {
                return Err(FilezError::AuthEvaluationError(
                    "No resource IDs provided for access control check".to_string(),
                ));
            };

            let owners_map: HashMap<Uuid, Uuid> = if let Some(owner_col) =
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

                // if the app is trusted and all requested resources are owned by the requesting user, return early
                if context_app.trusted
                    && resource_owners_vec.len() == requested_resource_ids.len()
                    && maybe_requesting_user.is_some_and(|requesting_user| {
                        resource_owners_vec
                            .iter()
                            .all(|ro| ro.owner_id == requesting_user.id)
                    })
                {
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
                }

                resource_owners_vec
                    .into_iter()
                    .map(|r| (r.resource_id, r.owner_id))
                    .collect()
            } else {
                // If no owner column is defined, we assume no ownership check is needed
                HashMap::new()
            };

            // 2. Fetch relevant Access Policies (Direct on Resource)

            let direct_policies = schema::access_policies::table
                .filter(schema::access_policies::resource_id.eq_any(requested_resource_ids))
                .filter(
                    schema::access_policies::resource_type.eq(&resource_auth_info.resource_type),
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

            let mut direct_policies_map: HashMap<Uuid, Vec<AccessPolicy>> = HashMap::new();
            for policy in direct_policies {
                direct_policies_map
                    .entry(policy.resource_id.ok_or(FilezError::AuthEvaluationError(
                        "Direct policy missing resource_id".to_string(),
                    ))?)
                    .or_default()
                    .push(policy);
            }

            // 3. Fetch Resource Group Memberships and their Policies (if applicable)

            let mut resource_group_policies_map: HashMap<Uuid, Vec<AccessPolicy>> = HashMap::new();
            let mut resource_group_memberships_map: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
            let mut relevant_resource_group_ids: HashSet<Uuid> = HashSet::new();

            if let (
                Some(group_membership_table),
                Some(group_membership_table_resource_id_column),
                Some(group_membership_table_group_id_column),
                Some(resource_group_type_policy_str),
            ) = (
                resource_auth_info.group_membership_table,
                resource_auth_info.group_membership_table_resource_id_column,
                resource_auth_info.group_membership_table_group_id_column,
                resource_auth_info.resource_group_type,
            ) {
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

                // Check direct DENY policies
                if let Some(policies) = direct_policies_map.get(resource_id) {
                    for policy in policies {
                        if policy.effect == AccessPolicyEffect::Deny {
                            denied = true;
                            current_evaluation.is_allowed = false;
                            current_evaluation.reason = match policy.subject_type {
                                AccessPolicySubjectType::User => {
                                    AuthReason::DeniedByDirectUserPolicy {
                                        policy_id: policy.id,
                                    }
                                }
                                AccessPolicySubjectType::UserGroup => {
                                    AuthReason::DeniedByDirectGroupPolicy {
                                        policy_id: policy.id,
                                        via_user_group_id: policy.subject_id,
                                    }
                                }
                                AccessPolicySubjectType::Public => {
                                    AuthReason::AllowedByPubliclyAccessible {
                                        policy_id: policy.id,
                                    }
                                }
                                AccessPolicySubjectType::ServerMember => {
                                    AuthReason::AllowedByServerAccessible {
                                        policy_id: policy.id,
                                    }
                                }
                            };
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
                                if policy.effect == AccessPolicyEffect::Deny {
                                    denied = true;
                                    current_evaluation.is_allowed = false;
                                    current_evaluation.reason = match policy.subject_type {
                                        AccessPolicySubjectType::User => {
                                            AuthReason::DeniedByResourceGroupUserPolicy {
                                                policy_id: policy.id,
                                                on_resource_group_id: resource_group_id.clone(),
                                            }
                                        }
                                        AccessPolicySubjectType::UserGroup => {
                                            AuthReason::DeniedByResourceGroupUserGroupPolicy {
                                                policy_id: policy.id,
                                                via_user_group_id: policy.subject_id,
                                                on_resource_group_id: resource_group_id.clone(),
                                            }
                                        }
                                        AccessPolicySubjectType::Public => {
                                            AuthReason::AllowedByPubliclyAccessible {
                                                policy_id: policy.id,
                                            }
                                        }
                                        AccessPolicySubjectType::ServerMember => {
                                            AuthReason::AllowedByServerAccessible {
                                                policy_id: policy.id,
                                            }
                                        }
                                    };
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
                        if policy.effect == AccessPolicyEffect::Allow {
                            allowed_by_direct = true;
                            current_evaluation.is_allowed = true;
                            current_evaluation.reason = match policy.subject_type {
                                AccessPolicySubjectType::User => {
                                    AuthReason::AllowedByDirectUserPolicy {
                                        policy_id: policy.id,
                                    }
                                }
                                AccessPolicySubjectType::UserGroup => {
                                    AuthReason::AllowedByDirectGroupPolicy {
                                        policy_id: policy.id,
                                        via_user_group_id: policy.subject_id,
                                    }
                                }
                                AccessPolicySubjectType::Public => {
                                    AuthReason::AllowedByPubliclyAccessible {
                                        policy_id: policy.id,
                                    }
                                }
                                AccessPolicySubjectType::ServerMember => {
                                    AuthReason::AllowedByServerAccessible {
                                        policy_id: policy.id,
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
                                if policy.effect == AccessPolicyEffect::Allow {
                                    allowed_by_resource_group = true;
                                    current_evaluation.is_allowed = true;
                                    current_evaluation.reason = match policy.subject_type {
                                        AccessPolicySubjectType::User => {
                                            AuthReason::AllowedByResourceGroupUserPolicy {
                                                policy_id: policy.id,
                                                on_resource_group_id: *rg_id,
                                            }
                                        }
                                        AccessPolicySubjectType::UserGroup => {
                                            AuthReason::AllowedByResourceGroupUserGroupPolicy {
                                                policy_id: policy.id,
                                                via_user_group_id: policy.subject_id,
                                                on_resource_group_id: *rg_id,
                                            }
                                        }
                                        AccessPolicySubjectType::Public => {
                                            AuthReason::AllowedByPubliclyAccessible {
                                                policy_id: policy.id,
                                            }
                                        }
                                        AccessPolicySubjectType::ServerMember => {
                                            AuthReason::AllowedByServerAccessible {
                                                policy_id: policy.id,
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
                    schema::access_policies::resource_type.eq(&resource_auth_info.resource_type),
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
                .find(|p| p.effect == AccessPolicyEffect::Deny)
            {
                let evaluation = AuthEvaluation {
                    resource_id: None,
                    is_allowed: false,
                    reason: match deny_policy.subject_type {
                        AccessPolicySubjectType::User => AuthReason::DeniedByDirectUserPolicy {
                            policy_id: deny_policy.id,
                        },
                        AccessPolicySubjectType::UserGroup => {
                            AuthReason::DeniedByDirectGroupPolicy {
                                policy_id: deny_policy.id,
                                via_user_group_id: deny_policy.subject_id,
                            }
                        }
                        AccessPolicySubjectType::Public => AuthReason::DeniedByPubliclyAccessible {
                            policy_id: deny_policy.id,
                        },
                        AccessPolicySubjectType::ServerMember => {
                            AuthReason::DeniedByServerAccessible {
                                policy_id: deny_policy.id,
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
                .find(|p| p.effect == AccessPolicyEffect::Allow)
            {
                let evaluation = AuthEvaluation {
                    resource_id: None,
                    is_allowed: true,
                    reason: match allow_policy.subject_type {
                        AccessPolicySubjectType::User => AuthReason::AllowedByDirectUserPolicy {
                            policy_id: allow_policy.id,
                        },
                        AccessPolicySubjectType::UserGroup => {
                            AuthReason::AllowedByDirectGroupPolicy {
                                policy_id: allow_policy.id,
                                via_user_group_id: allow_policy.subject_id,
                            }
                        }
                        AccessPolicySubjectType::Public => {
                            AuthReason::AllowedByPubliclyAccessible {
                                policy_id: allow_policy.id,
                            }
                        }
                        AccessPolicySubjectType::ServerMember => {
                            AuthReason::AllowedByServerAccessible {
                                policy_id: allow_policy.id,
                            }
                        }
                    },
                };
                return Ok(AuthResult {
                    access_granted: true,
                    evaluations: vec![evaluation],
                });
            }

            /*
            TODO: ??
            // If the app is trusted, and no policies exist, allow access by default
            if context_app_trusted {
                return Ok(AuthResult {
                    access_granted: true,
                    evaluations: vec![AuthEvaluation {
                        resource_id: None,
                        is_allowed: true,
                        reason: AuthReason::Owned, // Default to owned since no policies exist
                    }],
                });
            }*/

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
    owner_id: Uuid,
}

// Helper struct to hold fetched resource group memberships
#[derive(QueryableByName, Debug, Clone)]
struct ResourceGroupMembership {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    group_id: Uuid,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq, Deserialize, ToSchema)]
pub enum AuthReason {
    SuperAdmin,
    Owned,
    AllowedByPubliclyAccessible {
        policy_id: Uuid,
    },
    AllowedByServerAccessible {
        policy_id: Uuid,
    },
    AllowedByDirectUserPolicy {
        policy_id: Uuid,
    },
    AllowedByDirectGroupPolicy {
        policy_id: Uuid,
        via_user_group_id: Uuid,
    },
    AllowedByResourceGroupUserPolicy {
        policy_id: Uuid,
        on_resource_group_id: Uuid,
    },
    AllowedByResourceGroupUserGroupPolicy {
        policy_id: Uuid,
        via_user_group_id: Uuid,
        on_resource_group_id: Uuid,
    },
    DeniedByPubliclyAccessible {
        policy_id: Uuid,
    },
    DeniedByServerAccessible {
        policy_id: Uuid,
    },
    DeniedByDirectUserPolicy {
        policy_id: Uuid,
    },
    DeniedByDirectGroupPolicy {
        policy_id: Uuid,
        via_user_group_id: Uuid,
    },
    DeniedByResourceGroupUserPolicy {
        policy_id: Uuid,
        on_resource_group_id: Uuid,
    },
    DeniedByResourceGroupUserGroupPolicy {
        policy_id: Uuid,
        via_user_group_id: Uuid,
        on_resource_group_id: Uuid,
    },
    NoMatchingAllowPolicy,
    ResourceNotFound,
}

#[derive(Debug, Serialize, Clone, Deserialize, ToSchema)]
pub struct AuthEvaluation {
    pub resource_id: Option<Uuid>,
    pub is_allowed: bool,
    pub reason: AuthReason,
}

pub struct ResourceAuthInfo {
    pub resource_table: &'static str,
    pub resource_table_id_column: &'static str,
    pub resource_table_owner_column: Option<&'static str>,
    pub resource_type: AccessPolicyResourceType,

    // For resources that can be part of groups
    pub group_membership_table: Option<&'static str>,
    pub group_membership_table_resource_id_column: Option<&'static str>,
    pub group_membership_table_group_id_column: Option<&'static str>,
    pub resource_group_type: Option<AccessPolicyResourceType>,
}

pub fn get_auth_info(resource_type: AccessPolicyResourceType) -> ResourceAuthInfo {
    match resource_type {
        AccessPolicyResourceType::File => ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::File,
            group_membership_table: Some("file_file_group_members"),
            group_membership_table_resource_id_column: Some("file_id"),
            group_membership_table_group_id_column: Some("file_group_id"),
            resource_group_type: Some(AccessPolicyResourceType::FileGroup),
        },
        AccessPolicyResourceType::FileGroup => ResourceAuthInfo {
            resource_table: "file_groups",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::FileGroup,
            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
        AccessPolicyResourceType::User => ResourceAuthInfo {
            resource_table: "users",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("id"), // Users own themselves
            resource_type: AccessPolicyResourceType::User,
            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
        AccessPolicyResourceType::UserGroup => ResourceAuthInfo {
            resource_table: "user_groups",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::UserGroup,
            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
        AccessPolicyResourceType::StorageLocation => ResourceAuthInfo {
            resource_table: "storage_locations",
            resource_table_id_column: "id",
            resource_table_owner_column: None,
            resource_type: AccessPolicyResourceType::StorageLocation,

            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
        AccessPolicyResourceType::AccessPolicy => ResourceAuthInfo {
            resource_table: "access_policies",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::AccessPolicy,
            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
        AccessPolicyResourceType::StorageQuota => ResourceAuthInfo {
            resource_table: "storage_quotas",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::StorageQuota,
            group_membership_table: None,
            group_membership_table_resource_id_column: None,
            group_membership_table_group_id_column: None,
            resource_group_type: None,
        },
    }
}

#[derive(Debug, Serialize, Clone, Deserialize, ToSchema)]
pub struct AuthResult {
    pub access_granted: bool,
    pub evaluations: Vec<AuthEvaluation>,
}

impl AuthResult {
    pub fn is_allowed(&self) -> bool {
        self.access_granted
    }

    pub fn is_denied(&self) -> bool {
        !self.access_granted
    }

    pub fn verify(&self) -> Result<(), FilezError> {
        if self.is_allowed() {
            Ok(())
        } else {
            Err(FilezError::AuthEvaluationError("Access denied".to_string()))
        }
    }
}
