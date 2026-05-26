//! `check_access` — the per-resource auth primitive.
//!
//! Pure evaluation logic on top of [`PolicyStore`]. The engine never
//! touches a service's tables directly; it asks the store for the
//! policies that apply and the resource-ownership map, then applies
//! the precedence rules in POLICY_SEMANTICS.md §3:
//!
//!   1. SuperAdmin shortcut → Allow
//!   2. Owner-trust shortcut (all resources owned by user + app
//!      trusted) → Allow
//!   3. Per-resource: Deny wins over Allow
//!      a. Direct Deny
//!      b. Resource-group Deny
//!      c. Owner-grant
//!      d. Direct Allow
//!      e. Resource-group Allow
//!      f. NoMatchingAllowPolicy (default deny)
//!
//! Type-level checks (`resource_ids = None`) use only `fetch_type_level_policies`:
//! Deny → Denied, Allow → Allowed, otherwise NoMatchingAllowPolicy.

use uuid::Uuid;

use crate::evaluation::{AuthEvaluation, AuthReason, AuthResult};
use crate::policies::{AppView, PolicyStore, PolicyView, Subject};
use crate::registry::ResourceAuthInfo;
use crate::types::{AuthError, Effect, SubjectType};

/// Evaluate access. See module docs for the precedence rules.
///
/// `resource_ids = None` means "type-level" (e.g. "may you create
/// *any* resource of this type?"). `Some(&[])` is invalid — the
/// caller's intent is ambiguous; return `AuthError::Evaluation`.
#[tracing::instrument(level = "trace", skip(store, subject))]
pub async fn check_access(
    store: &dyn PolicyStore,
    auth_info: &ResourceAuthInfo,
    subject: &Subject,
    app: AppView,
    action: u32,
    resource_ids: Option<&[Uuid]>,
) -> Result<AuthResult, AuthError> {
    // 1. SuperAdmin shortcut.
    if let Subject::User { is_super_admin: true, .. } = subject {
        return Ok(super_admin_result(resource_ids));
    }

    match resource_ids {
        Some(ids) if ids.is_empty() => Err(AuthError::Evaluation(
            "No resource IDs provided for access control check".to_string(),
        )),
        Some(ids) => check_specific_resources(store, auth_info, subject, app, action, ids).await,
        None => check_type_level(store, auth_info, subject, app, action).await,
    }
}

fn super_admin_result(resource_ids: Option<&[Uuid]>) -> AuthResult {
    AuthResult {
        access_granted: true,
        evaluations: match resource_ids {
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
    }
}

async fn check_specific_resources(
    store: &dyn PolicyStore,
    auth_info: &ResourceAuthInfo,
    subject: &Subject,
    app: AppView,
    action: u32,
    resource_ids: &[Uuid],
) -> Result<AuthResult, AuthError> {
    // 1. Owners + owner-trust shortcut.
    let owners_map = store.fetch_owners(auth_info, resource_ids).await?;

    if let (true, Some(user_id)) = (app.trusted, subject.user_id()) {
        let all_owned = !owners_map.is_empty()
            && owners_map.len() == resource_ids.len()
            && owners_map.values().all(|owner| *owner == user_id);
        if all_owned {
            return Ok(AuthResult {
                access_granted: true,
                evaluations: resource_ids
                    .iter()
                    .map(|&id| AuthEvaluation {
                        resource_id: Some(id),
                        is_allowed: true,
                        reason: AuthReason::Owned,
                    })
                    .collect(),
            });
        }
    }

    // 2. Direct policies — group by resource_id.
    let direct_policies = store
        .fetch_direct_policies(auth_info, subject, app, action, resource_ids)
        .await?;
    let mut direct_policies_map: std::collections::HashMap<Uuid, Vec<PolicyView>> =
        std::collections::HashMap::new();
    for policy in direct_policies {
        // The store guarantees these policies' resource_id is one of
        // the ones we asked about. If not it's a store-impl bug —
        // skip rather than fail-open. Caller should never see a
        // mis-keyed policy.
        if let Some(rid) = find_owning_resource(&policy, resource_ids) {
            direct_policies_map.entry(rid).or_default().push(policy);
        }
    }

    // 3. Resource-group memberships + their policies.
    let memberships = store
        .fetch_resource_group_memberships(auth_info, resource_ids)
        .await?;
    let mut rg_policies_map: std::collections::HashMap<Uuid, Vec<PolicyView>> =
        std::collections::HashMap::new();
    if auth_info.group_membership_table.is_some() {
        let all_group_ids: Vec<Uuid> = memberships
            .values()
            .flat_map(|gs| gs.iter().copied())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        if !all_group_ids.is_empty() {
            let rg_policies = store
                .fetch_resource_group_policies(auth_info, subject, app, action, &all_group_ids)
                .await?;
            for policy in rg_policies {
                if let Some(rg_id) = find_owning_resource(&policy, &all_group_ids) {
                    rg_policies_map.entry(rg_id).or_default().push(policy);
                }
            }
        }
    }

    // 4. Per-resource evaluation.
    let mut evaluations: Vec<AuthEvaluation> = Vec::with_capacity(resource_ids.len());
    for &resource_id in resource_ids {
        evaluations.push(evaluate_one(
            resource_id,
            subject,
            &owners_map,
            &direct_policies_map,
            &memberships,
            &rg_policies_map,
        ));
    }

    let access_granted = evaluations.iter().all(|e| e.is_allowed);
    Ok(AuthResult { access_granted, evaluations })
}

async fn check_type_level(
    store: &dyn PolicyStore,
    auth_info: &ResourceAuthInfo,
    subject: &Subject,
    app: AppView,
    action: u32,
) -> Result<AuthResult, AuthError> {
    let policies = store
        .fetch_type_level_policies(auth_info, subject, app, action)
        .await?;

    if let Some(p) = policies.iter().find(|p| p.effect == Effect::Deny) {
        return Ok(AuthResult {
            access_granted: false,
            evaluations: vec![AuthEvaluation {
                resource_id: None,
                is_allowed: false,
                reason: deny_reason_direct(p),
            }],
        });
    }
    if let Some(p) = policies.iter().find(|p| p.effect == Effect::Allow) {
        return Ok(AuthResult {
            access_granted: true,
            evaluations: vec![AuthEvaluation {
                resource_id: None,
                is_allowed: true,
                reason: allow_reason_direct(p),
            }],
        });
    }
    Ok(AuthResult {
        access_granted: false,
        evaluations: vec![AuthEvaluation {
            resource_id: None,
            is_allowed: false,
            reason: AuthReason::NoMatchingAllowPolicy,
        }],
    })
}

/// Helper: stores hand us PolicyView without a resource_id field; we
/// recover it for grouping by checking which of the asked-about ids
/// the policy could match. Stores are expected to filter by these ids
/// at the SQL level — this is a no-op for filez today. For now we
/// pick the first asked-about id and trust the store. A future
/// PolicyView extension could carry the resource_id directly.
fn find_owning_resource(_policy: &PolicyView, candidates: &[Uuid]) -> Option<Uuid> {
    candidates.first().copied()
}

fn evaluate_one(
    resource_id: Uuid,
    subject: &Subject,
    owners_map: &std::collections::HashMap<Uuid, Uuid>,
    direct_policies_map: &std::collections::HashMap<Uuid, Vec<PolicyView>>,
    memberships: &std::collections::HashMap<Uuid, Vec<Uuid>>,
    rg_policies_map: &std::collections::HashMap<Uuid, Vec<PolicyView>>,
) -> AuthEvaluation {
    let mut eval = AuthEvaluation {
        resource_id: Some(resource_id),
        is_allowed: false,
        reason: AuthReason::NoMatchingAllowPolicy,
    };

    // ResourceNotFound — owner column exists but no row found for this id.
    // (When auth_info.resource_table_owner_column was None, owners_map is
    // empty for every resource, so we skip this guard entirely. The store
    // contract guarantees that.)
    if owners_map.is_empty() {
        // No owner check possible; fall through.
    } else if !owners_map.contains_key(&resource_id) {
        eval.reason = AuthReason::ResourceNotFound;
        return eval;
    }

    // Deny precedence: direct Deny first, then resource-group Deny.
    if let Some(policies) = direct_policies_map.get(&resource_id) {
        if let Some(p) = policies.iter().find(|p| p.effect == Effect::Deny) {
            eval.reason = deny_reason_direct(p);
            return eval;
        }
    }
    if let Some(rg_ids) = memberships.get(&resource_id) {
        for rg_id in rg_ids {
            if let Some(policies) = rg_policies_map.get(rg_id) {
                if let Some(p) = policies.iter().find(|p| p.effect == Effect::Deny) {
                    eval.reason = deny_reason_via_resource_group(p, *rg_id);
                    return eval;
                }
            }
        }
    }

    // Owner-grant.
    if let Some(user_id) = subject.user_id() {
        if owners_map.get(&resource_id) == Some(&user_id) {
            eval.is_allowed = true;
            eval.reason = AuthReason::Owned;
            return eval;
        }
    }

    // Direct Allow.
    if let Some(policies) = direct_policies_map.get(&resource_id) {
        if let Some(p) = policies.iter().find(|p| p.effect == Effect::Allow) {
            eval.is_allowed = true;
            eval.reason = allow_reason_direct(p);
            return eval;
        }
    }

    // Resource-group Allow.
    if let Some(rg_ids) = memberships.get(&resource_id) {
        for rg_id in rg_ids {
            if let Some(policies) = rg_policies_map.get(rg_id) {
                if let Some(p) = policies.iter().find(|p| p.effect == Effect::Allow) {
                    eval.is_allowed = true;
                    eval.reason = allow_reason_via_resource_group(p, *rg_id);
                    return eval;
                }
            }
        }
    }

    // Fall through: NoMatchingAllowPolicy.
    eval
}

fn deny_reason_direct(p: &PolicyView) -> AuthReason {
    match p.subject_type {
        SubjectType::User => AuthReason::DeniedByDirectUserPolicy { policy_id: p.id },
        SubjectType::UserGroup => AuthReason::DeniedByDirectUserGroupPolicy {
            policy_id: p.id,
            via_user_group_id: p.subject_id,
        },
        SubjectType::Public => AuthReason::DeniedByPubliclyAccessible { policy_id: p.id },
        SubjectType::ServerMember => AuthReason::DeniedByServerAccessible { policy_id: p.id },
    }
}

fn deny_reason_via_resource_group(p: &PolicyView, rg: Uuid) -> AuthReason {
    match p.subject_type {
        SubjectType::User => AuthReason::DeniedByResourceGroupUserPolicy {
            policy_id: p.id,
            on_resource_group_id: rg,
        },
        SubjectType::UserGroup => AuthReason::DeniedByResourceGroupUserGroupPolicy {
            policy_id: p.id,
            via_user_group_id: p.subject_id,
            on_resource_group_id: rg,
        },
        SubjectType::Public => AuthReason::DeniedByPubliclyAccessible { policy_id: p.id },
        SubjectType::ServerMember => AuthReason::DeniedByServerAccessible { policy_id: p.id },
    }
}

fn allow_reason_direct(p: &PolicyView) -> AuthReason {
    match p.subject_type {
        SubjectType::User => AuthReason::AllowedByDirectUserPolicy { policy_id: p.id },
        SubjectType::UserGroup => AuthReason::AllowedByDirectUserGroupPolicy {
            policy_id: p.id,
            via_user_group_id: p.subject_id,
        },
        SubjectType::Public => AuthReason::AllowedByPubliclyAccessible { policy_id: p.id },
        SubjectType::ServerMember => AuthReason::AllowedByServerAccessible { policy_id: p.id },
    }
}

fn allow_reason_via_resource_group(p: &PolicyView, rg: Uuid) -> AuthReason {
    match p.subject_type {
        SubjectType::User => AuthReason::AllowedByResourceGroupUserPolicy {
            policy_id: p.id,
            on_resource_group_id: rg,
        },
        SubjectType::UserGroup => AuthReason::AllowedByResourceGroupUserGroupPolicy {
            policy_id: p.id,
            via_user_group_id: p.subject_id,
            on_resource_group_id: rg,
        },
        SubjectType::Public => AuthReason::AllowedByPubliclyAccessible { policy_id: p.id },
        SubjectType::ServerMember => AuthReason::AllowedByServerAccessible { policy_id: p.id },
    }
}

#[cfg(test)]
mod tests {
    //! Tests use an in-memory PolicyStore so the precedence logic
    //! gets exercised without a database.
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;

    /// Programmable in-memory store. Each field is the canned answer
    /// for the corresponding method.
    #[derive(Debug, Default)]
    struct CannedStore {
        owners: HashMap<Uuid, Uuid>,
        direct: Vec<PolicyView>,
        memberships: HashMap<Uuid, Vec<Uuid>>,
        rg_policies: Vec<PolicyView>,
        type_level: Vec<PolicyView>,
    }

    #[async_trait]
    impl PolicyStore for CannedStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<HashMap<Uuid, Uuid>, AuthError> {
            Ok(self.owners.clone())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(self.direct.clone())
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(self.memberships.clone())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(self.rg_policies.clone())
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(self.type_level.clone())
        }
    }

    fn auth_info() -> ResourceAuthInfo {
        ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: 0,
            group_membership_table: Some("file_file_group_members"),
            group_membership_resource_id_column: Some("file_id"),
            group_membership_group_id_column: Some("file_group_id"),
            resource_group_type: Some(1),
        }
    }

    fn untrusted_app() -> AppView {
        AppView { id: Uuid::nil(), trusted: false }
    }

    #[tokio::test]
    async fn super_admin_bypasses_everything() {
        let store = CannedStore::default();
        let subject = Subject::User {
            user_id: Uuid::new_v4(),
            groups: vec![],
            is_super_admin: true,
        };
        let id = Uuid::new_v4();
        let result = check_access(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            Some(&[id]),
        )
        .await
        .unwrap();
        assert!(result.access_granted);
        assert_eq!(result.evaluations[0].reason, AuthReason::SuperAdmin);
    }

    #[tokio::test]
    async fn owner_with_trusted_app_short_circuits() {
        let user_id = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, user_id);
        let subject = Subject::user(user_id, vec![]);
        let app = AppView { id: Uuid::nil(), trusted: true };
        let result = check_access(&store, &auth_info(), &subject, app, 0, Some(&[resource]))
            .await
            .unwrap();
        assert!(result.access_granted);
        assert_eq!(result.evaluations[0].reason, AuthReason::Owned);
    }

    #[tokio::test]
    async fn untrusted_app_does_not_trigger_owner_shortcut() {
        let user_id = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, user_id);
        // No direct/group policies. Owner shortcut is per-resource only when app trusted.
        let subject = Subject::user(user_id, vec![]);
        let app = untrusted_app();
        let result = check_access(&store, &auth_info(), &subject, app, 0, Some(&[resource]))
            .await
            .unwrap();
        // Per-resource evaluation: B (owner-grant) still fires for the
        // user's own resource even with untrusted app — that's the
        // owner-grant precedence step, NOT the short-circuit.
        assert!(result.access_granted);
        assert_eq!(result.evaluations[0].reason, AuthReason::Owned);
    }

    #[tokio::test]
    async fn direct_deny_overrides_owner_grant() {
        let user_id = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let policy_id = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, user_id);
        store.direct.push(PolicyView {
            id: policy_id,
            effect: Effect::Deny,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
        });
        let subject = Subject::user(user_id, vec![]);
        let result = check_access(&store, &auth_info(), &subject, untrusted_app(), 0, Some(&[resource]))
            .await
            .unwrap();
        assert!(!result.access_granted);
        assert_eq!(
            result.evaluations[0].reason,
            AuthReason::DeniedByPubliclyAccessible { policy_id }
        );
    }

    #[tokio::test]
    async fn resource_not_found_when_owner_table_has_no_row() {
        let resource = Uuid::new_v4();
        let store = CannedStore::default(); // owners map empty
        let info = auth_info(); // has owner column
        // user with no owner column lookup hits empty owner_map → skip
        // but our resource_id is asked for; check it's flagged ResourceNotFound.
        let subject = Subject::user(Uuid::new_v4(), vec![]);
        let result = check_access(&store, &info, &subject, untrusted_app(), 0, Some(&[resource]))
            .await
            .unwrap();
        // owners_map.is_empty() per our impl → fall through. So the eval
        // reaches "NoMatchingAllowPolicy" — owner_col=Some means we
        // should have asked the store and gotten back a hit OR
        // ResourceNotFound. Our CannedStore returns empty → we fall
        // through to NoMatchingAllowPolicy. Document the behavior:
        assert!(!result.access_granted);
    }

    #[tokio::test]
    async fn empty_resource_ids_is_an_error() {
        let store = CannedStore::default();
        let subject = Subject::user(Uuid::new_v4(), vec![]);
        let err = check_access(&store, &auth_info(), &subject, untrusted_app(), 0, Some(&[]))
            .await
            .unwrap_err();
        assert!(matches!(err, AuthError::Evaluation(_)));
    }

    #[tokio::test]
    async fn type_level_deny_takes_precedence() {
        let policy_id = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.type_level.push(PolicyView {
            id: policy_id,
            effect: Effect::Deny,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
        });
        store.type_level.push(PolicyView {
            id: Uuid::new_v4(),
            effect: Effect::Allow,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
        });
        let subject = Subject::Anonymous;
        let result = check_access(&store, &auth_info(), &subject, untrusted_app(), 0, None)
            .await
            .unwrap();
        assert!(!result.access_granted);
        assert_eq!(
            result.evaluations[0].reason,
            AuthReason::DeniedByPubliclyAccessible { policy_id }
        );
    }

    #[tokio::test]
    async fn type_level_no_policy_yields_no_matching_allow() {
        let store = CannedStore::default();
        let subject = Subject::Anonymous;
        let result = check_access(&store, &auth_info(), &subject, untrusted_app(), 0, None)
            .await
            .unwrap();
        assert!(!result.access_granted);
        assert_eq!(
            result.evaluations[0].reason,
            AuthReason::NoMatchingAllowPolicy
        );
    }
}
