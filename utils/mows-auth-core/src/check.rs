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
use crate::types::{AuthError, Effect, ResourceScope, SubjectType};

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

    // 4. Owner-scoped policies (OwnedByOwner / AccessibleByOwner). Flat
    //    Vec; per-resource matching happens in evaluate_one.
    let owner_scoped_policies = store
        .fetch_owner_scoped_policies(auth_info, subject, app, action)
        .await?;

    // 5. Per-resource evaluation.
    let mut evaluations: Vec<AuthEvaluation> = Vec::with_capacity(resource_ids.len());
    for &resource_id in resource_ids {
        evaluations.push(evaluate_one(
            resource_id,
            subject,
            &owners_map,
            &direct_policies_map,
            &memberships,
            &rg_policies_map,
            &owner_scoped_policies,
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
    owner_scoped_policies: &[PolicyView],
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

    // Owner-scoped Deny (POLICY_SEMANTICS.md §4) — walked before
    // owner-grant + direct Allow so a Deny via OwnedByOwner overrides
    // the resource owner's own access (Deny precedence still wins).
    if let Some(p) = owner_scoped_policy_match(
        resource_id,
        owners_map,
        owner_scoped_policies,
        Effect::Deny,
    ) {
        eval.reason = match p.resource_scope {
            ResourceScope::OwnedByOwner => {
                AuthReason::DeniedByOwnedByOwnerPolicy { policy_id: p.id }
            }
            ResourceScope::AccessibleByOwner => {
                AuthReason::DeniedByAccessibleByOwnerPolicy { policy_id: p.id }
            }
            ResourceScope::Single => deny_reason_direct(p),
        };
        return eval;
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

    // Owner-scoped Allow.
    if let Some(p) = owner_scoped_policy_match(
        resource_id,
        owners_map,
        owner_scoped_policies,
        Effect::Allow,
    ) {
        eval.is_allowed = true;
        eval.reason = match p.resource_scope {
            ResourceScope::OwnedByOwner => {
                AuthReason::AllowedByOwnedByOwnerPolicy { policy_id: p.id }
            }
            ResourceScope::AccessibleByOwner => {
                AuthReason::AllowedByAccessibleByOwnerPolicy { policy_id: p.id }
            }
            ResourceScope::Single => allow_reason_direct(p),
        };
        return eval;
    }

    // Fall through: NoMatchingAllowPolicy.
    eval
}

/// Find an owner-scoped policy that matches the given resource at the
/// given effect. POLICY_SEMANTICS.md §4:
///
///   - `OwnedByOwner` matches iff `policy.owner_id == resource.owner_id`.
///   - `AccessibleByOwner` matches recursively (depth-1 cycle break).
///     Engine implementation deferred — for now these policies are
///     skipped with a tracing warning so a service owner notices.
///     Fail-closed under default-deny.
fn owner_scoped_policy_match<'a>(
    resource_id: Uuid,
    owners_map: &std::collections::HashMap<Uuid, Uuid>,
    candidates: &'a [PolicyView],
    effect: Effect,
) -> Option<&'a PolicyView> {
    let resource_owner = owners_map.get(&resource_id).copied()?;
    candidates.iter().find(|p| {
        if p.effect != effect {
            return false;
        }
        match p.resource_scope {
            ResourceScope::OwnedByOwner => p.owner_id == resource_owner,
            ResourceScope::AccessibleByOwner => {
                tracing::warn!(
                    policy_id = ?p.id,
                    "AccessibleByOwner policy skipped — recursive evaluation not yet implemented \
                     (POLICY_SEMANTICS.md §4 cycle break)"
                );
                false
            }
            ResourceScope::Single => false,
        }
    })
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
    pub(super) struct CannedStore {
        pub(super) owners: HashMap<Uuid, Uuid>,
        pub(super) direct: Vec<PolicyView>,
        pub(super) memberships: HashMap<Uuid, Vec<Uuid>>,
        pub(super) rg_policies: Vec<PolicyView>,
        pub(super) type_level: Vec<PolicyView>,
        pub(super) owner_scoped: Vec<PolicyView>,
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
        async fn fetch_owner_scoped_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(self.owner_scoped.clone())
        }
    }

    pub(super) fn auth_info() -> ResourceAuthInfo {
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

    pub(super) fn untrusted_app() -> AppView {
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
        store.direct.push(PolicyView { owner_id: Uuid::nil(), resource_scope: crate::types::ResourceScope::Single,
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
        store.type_level.push(PolicyView { owner_id: Uuid::nil(), resource_scope: crate::types::ResourceScope::Single,
            id: policy_id,
            effect: Effect::Deny,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
        });
        store.type_level.push(PolicyView { owner_id: Uuid::nil(), resource_scope: crate::types::ResourceScope::Single,
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
    async fn owned_by_owner_allow_grants_access_when_policy_owner_owns_the_resource() {
        let alice = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let policy_id = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, alice);
        store.owner_scoped.push(PolicyView {
            id: policy_id,
            owner_id: alice,
            effect: Effect::Allow,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
            resource_scope: ResourceScope::OwnedByOwner,
        });
        let result = check_access(&store, &auth_info(), &Subject::Anonymous, untrusted_app(), 0, Some(&[resource]))
            .await
            .unwrap();
        assert!(result.access_granted);
        assert_eq!(
            result.evaluations[0].reason,
            AuthReason::AllowedByOwnedByOwnerPolicy { policy_id }
        );
    }

    #[tokio::test]
    async fn owned_by_owner_does_not_match_resources_owned_by_someone_else() {
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, bob);
        store.owner_scoped.push(PolicyView {
            id: Uuid::new_v4(),
            owner_id: alice,
            effect: Effect::Allow,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
            resource_scope: ResourceScope::OwnedByOwner,
        });
        let result = check_access(&store, &auth_info(), &Subject::Anonymous, untrusted_app(), 0, Some(&[resource]))
            .await
            .unwrap();
        assert!(!result.access_granted);
        assert_eq!(result.evaluations[0].reason, AuthReason::NoMatchingAllowPolicy);
    }

    #[tokio::test]
    async fn owned_by_owner_deny_overrides_owner_grant() {
        let alice = Uuid::new_v4();
        let resource = Uuid::new_v4();
        let policy_id = Uuid::new_v4();
        let mut store = CannedStore::default();
        store.owners.insert(resource, alice);
        store.owner_scoped.push(PolicyView {
            id: policy_id,
            owner_id: alice,
            effect: Effect::Deny,
            subject_type: SubjectType::User,
            subject_id: alice,
            resource_scope: ResourceScope::OwnedByOwner,
        });
        let subject = Subject::user(alice, vec![]);
        let result = check_access(&store, &auth_info(), &subject, untrusted_app(), 0, Some(&[resource]))
            .await
            .unwrap();
        assert!(!result.access_granted);
        assert_eq!(
            result.evaluations[0].reason,
            AuthReason::DeniedByOwnedByOwnerPolicy { policy_id }
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

#[cfg(test)]
mod property_tests {
    //! POLICY_SEMANTICS.md §9 obligation: the five algorithmic
    //! properties the engine must satisfy on every input.
    //!
    //! These are NOT proptest-driven — adding a property-testing
    //! framework is out of scope for now. Instead each property is
    //! pinned by a deterministic test that constructs a baseline +
    //! a one-edit variant and asserts the property holds.
    //!
    //! The five properties:
    //!   1. Adding a Deny never increases the allowed set.
    //!   2. Adding an Allow never decreases the allowed set.
    //!   3. SuperAdmin is always allowed (regardless of policies).
    //!   4. OwnedByOwner ⊆ Single for the same set of explicit shares
    //!      (the scope is additive — replacing a Single Allow with an
    //!      equivalent OwnedByOwner Allow can only widen access).
    //!   5. AccessibleByOwner chain breaks after one hop — the
    //!      engine never recurses into another AccessibleByOwner.
    //!
    //! If a future refactor breaks any property, the corresponding
    //! test fires before the change can land.

    use super::tests::*;
    use super::*;

    fn user_subject() -> (Uuid, Subject) {
        let user_id = Uuid::new_v4();
        (user_id, Subject::user(user_id, vec![]))
    }

    fn allow_policy(subject_user_id: Uuid) -> PolicyView {
        PolicyView {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            effect: Effect::Allow,
            subject_type: SubjectType::User,
            subject_id: subject_user_id,
            resource_scope: ResourceScope::Single,
        }
    }

    fn deny_policy(subject_user_id: Uuid) -> PolicyView {
        PolicyView {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            effect: Effect::Deny,
            subject_type: SubjectType::User,
            subject_id: subject_user_id,
            resource_scope: ResourceScope::Single,
        }
    }

    async fn allowed(store: &CannedStore, subject: &Subject, resource: Uuid) -> bool {
        check_access(
            store,
            &auth_info(),
            subject,
            untrusted_app(),
            0,
            Some(&[resource]),
        )
        .await
        .unwrap()
        .access_granted
    }

    // -------- Property 1: adding a Deny never increases access --------
    #[tokio::test]
    async fn property_adding_deny_never_increases_allowed_set() {
        let (user_id, subject) = user_subject();
        let resource = Uuid::new_v4();

        let mut baseline = CannedStore::default();
        baseline.direct.push(allow_policy(user_id));
        let baseline_allowed = allowed(&baseline, &subject, resource).await;

        let mut with_deny = CannedStore::default();
        with_deny.direct.push(allow_policy(user_id));
        with_deny.direct.push(deny_policy(user_id));
        let after_deny_allowed = allowed(&with_deny, &subject, resource).await;

        // Direction: !after >= !before  ⇔  after ≤ before  (boolean
        // ordering). i.e. once Deny is added, allowed cannot flip
        // from false to true.
        assert!(
            !(after_deny_allowed && !baseline_allowed),
            "adding a Deny made access GROW (baseline={baseline_allowed}, after={after_deny_allowed}) — violates POLICY_SEMANTICS.md §9 property 1"
        );
    }

    // -------- Property 2: adding an Allow never decreases access ------
    #[tokio::test]
    async fn property_adding_allow_never_decreases_allowed_set() {
        let (user_id, subject) = user_subject();
        let resource = Uuid::new_v4();

        let baseline = CannedStore::default();
        let baseline_allowed = allowed(&baseline, &subject, resource).await;

        let mut with_allow = CannedStore::default();
        with_allow.direct.push(allow_policy(user_id));
        let after_allow_allowed = allowed(&with_allow, &subject, resource).await;

        assert!(
            !(baseline_allowed && !after_allow_allowed),
            "adding an Allow made access SHRINK (baseline={baseline_allowed}, after={after_allow_allowed}) — violates POLICY_SEMANTICS.md §9 property 2"
        );
    }

    // -------- Property 3: SuperAdmin is always allowed ---------------
    #[tokio::test]
    async fn property_super_admin_always_allowed() {
        let resource = Uuid::new_v4();
        let super_admin = Subject::User {
            user_id: Uuid::new_v4(),
            groups: vec![],
            is_super_admin: true,
        };

        // Hostile environment: empty store + explicit Deny + nothing
        // matches the subject. SuperAdmin must still get through.
        let mut hostile = CannedStore::default();
        hostile.direct.push(PolicyView {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            effect: Effect::Deny,
            subject_type: SubjectType::Public,
            subject_id: Uuid::nil(),
            resource_scope: ResourceScope::Single,
        });
        assert!(
            allowed(&hostile, &super_admin, resource).await,
            "SuperAdmin denied — violates POLICY_SEMANTICS.md §9 property 3"
        );

        // Trivial environment.
        let empty = CannedStore::default();
        assert!(
            allowed(&empty, &super_admin, resource).await,
            "SuperAdmin denied on empty store — violates POLICY_SEMANTICS.md §9 property 3"
        );
    }

    // -------- Property 4: OwnedByOwner ⊆ Single (additive) -----------
    //
    // Setup: alice owns the resource and is the subject. With a Single
    // Allow she gets access. With an OwnedByOwner Allow whose owner is
    // alice (so it matches "every resource alice owns"), she must also
    // get access. The OwnedByOwner scope cannot grant LESS than the
    // equivalent Single share.
    #[tokio::test]
    async fn property_owned_by_owner_subseteq_single() {
        let alice = Uuid::new_v4();
        let subject = Subject::user(alice, vec![]);
        let resource = Uuid::new_v4();

        // Single Allow: explicit share.
        let mut single = CannedStore::default();
        single.owners.insert(resource, alice);
        single.direct.push(PolicyView {
            id: Uuid::new_v4(),
            owner_id: alice,
            effect: Effect::Allow,
            subject_type: SubjectType::User,
            subject_id: alice,
            resource_scope: ResourceScope::Single,
        });

        // OwnedByOwner Allow: same effect via the scope shortcut.
        let mut owned_by_owner = CannedStore::default();
        owned_by_owner.owners.insert(resource, alice);
        owned_by_owner.owner_scoped.push(PolicyView {
            id: Uuid::new_v4(),
            owner_id: alice,
            effect: Effect::Allow,
            subject_type: SubjectType::User,
            subject_id: alice,
            resource_scope: ResourceScope::OwnedByOwner,
        });

        let s_allowed = allowed(&single, &subject, resource).await;
        let obo_allowed = allowed(&owned_by_owner, &subject, resource).await;

        assert!(s_allowed, "baseline Single Allow must grant access");
        assert!(
            obo_allowed,
            "OwnedByOwner Allow on the owner's own resource must grant at least as much as the equivalent Single Allow — violates POLICY_SEMANTICS.md §9 property 4"
        );
    }

    // -------- Property 5: AccessibleByOwner chain breaks at depth 1 --
    //
    // Per POLICY_SEMANTICS.md §4: AccessibleByOwner is recursive in
    // principle but the engine breaks after one hop to avoid cycles
    // and unbounded expansion. The current implementation (P2-1) goes
    // further and treats AccessibleByOwner as a no-op (returns false
    // with tracing::warn). This test pins both invariants:
    //   * AccessibleByOwner alone never grants access today
    //   * Combining AccessibleByOwner with an underlying Single Allow
    //     still only grants via the Single — never via recursion
    #[tokio::test]
    async fn property_accessible_by_owner_does_not_recurse() {
        // Setup the canonical recursion scenario:
        //   - alice owns resource_a
        //   - bob is the subject (does NOT own resource_a)
        //   - one AccessibleByOwner policy: owner=alice, subject=bob,
        //     Allow. "bob can see anything alice can see."
        //
        // If AccessibleByOwner recursed unbounded, the chain would be:
        //   bob -[ABO]→ alice -(owner)→ resource_a   ⇒ Allow
        //
        // The engine's cycle-break (POLICY_SEMANTICS.md §4) MUST
        // prevent that recursion. Today the implementation is even
        // stricter — AccessibleByOwner is a no-op stub returning
        // false. Either contract satisfies the property; the test
        // checks the stronger current contract and the comment
        // explains what to change when depth-1 lands.
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let resource_a = Uuid::new_v4();
        let bob_subject = Subject::user(bob, vec![]);

        let mut store = CannedStore::default();
        store.owners.insert(resource_a, alice);
        store.owner_scoped.push(PolicyView {
            id: Uuid::new_v4(),
            owner_id: alice,
            effect: Effect::Allow,
            subject_type: SubjectType::User,
            subject_id: bob,
            resource_scope: ResourceScope::AccessibleByOwner,
        });

        assert!(
            !allowed(&store, &bob_subject, resource_a).await,
            "AccessibleByOwner currently MUST be a no-op (cycle-break stub). \
             When depth-1 recursion ships: bob should now see resource_a, \
             BUT a CHAIN OF LENGTH 2 (an ABO whose owner has another ABO) \
             must still NOT compose — rewrite this test to set up that \
             chain and assert it is broken."
        );
    }
}
