//! Engine-side return shapes for [`check_access`](crate::check_access).
//!
//! These types are the canonical form of "what happened during the
//! authorization decision" — the policy that fired (if any), the
//! subject path it matched on, the resource it covered. Every
//! consuming service eventually returns these directly from its
//! handlers; for now (Phase 1.2) filez keeps its own equivalents and
//! converts via [`From`] impls so the OpenAPI surface stays
//! byte-stable.
//!
//! IDs are raw [`Uuid`]s here — the engine deliberately does not
//! know about service-specific newtypes like filez's `AccessPolicyId`
//! or `UserGroupId`. Conversions live at the service boundary.
//!
//! Wire stability: the variant names are persisted in audit logs
//! (`mows_auth.events.result` JSONB column eventually); renaming or
//! reordering them is a breaking change to historical audit data.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// Why `check_access` returned the answer it did. One variant per
/// distinguishable code path — services can switch on this for audit
/// log enrichment and for "why was I denied?" UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum AuthReason {
    /// The principal has the `SuperAdmin` user type. Bypasses
    /// per-resource checks; logged so audit can still spot
    /// admin-driven actions.
    SuperAdmin,

    /// The principal owns the resource. Owner-direct shortcut — no
    /// policy table row consulted.
    Owned,

    AllowedByPubliclyAccessible { policy_id: Uuid },
    AllowedByServerAccessible { policy_id: Uuid },
    AllowedByDirectUserPolicy { policy_id: Uuid },
    AllowedByDirectUserGroupPolicy {
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

    DeniedByPubliclyAccessible { policy_id: Uuid },
    DeniedByServerAccessible { policy_id: Uuid },
    DeniedByDirectUserPolicy { policy_id: Uuid },
    DeniedByDirectUserGroupPolicy {
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

    /// No active Allow policy covered the requested action and no
    /// Deny fired either — default-deny per
    /// POLICY_SEMANTICS.md §3.
    NoMatchingAllowPolicy,

    /// The resource lookup itself returned nothing. Surfaced as the
    /// reason so handlers can distinguish "doesn't exist" from
    /// "exists but you can't see it" in *internal* logs while still
    /// returning the same HTTP status to the outside world (see
    /// `OPEN_QUESTIONS.md` Q14).
    ResourceNotFound,
}

impl AuthReason {
    /// Is this an Allow / SuperAdmin / Owned outcome?
    pub fn is_allow(&self) -> bool {
        matches!(
            self,
            AuthReason::SuperAdmin
                | AuthReason::Owned
                | AuthReason::AllowedByPubliclyAccessible { .. }
                | AuthReason::AllowedByServerAccessible { .. }
                | AuthReason::AllowedByDirectUserPolicy { .. }
                | AuthReason::AllowedByDirectUserGroupPolicy { .. }
                | AuthReason::AllowedByResourceGroupUserPolicy { .. }
                | AuthReason::AllowedByResourceGroupUserGroupPolicy { .. }
        )
    }

    /// If this reason was produced by a specific `access_policies`
    /// row, return its id. Owner shortcuts and SuperAdmin return
    /// `None`. Used by per-service quota layers (see
    /// `USAGE_LIMITS.md`) to charge usage against the policy that
    /// authorised the action.
    pub fn via_policy_id(&self) -> Option<Uuid> {
        match self {
            AuthReason::SuperAdmin
            | AuthReason::Owned
            | AuthReason::NoMatchingAllowPolicy
            | AuthReason::ResourceNotFound => None,
            AuthReason::AllowedByPubliclyAccessible { policy_id }
            | AuthReason::AllowedByServerAccessible { policy_id }
            | AuthReason::AllowedByDirectUserPolicy { policy_id }
            | AuthReason::AllowedByDirectUserGroupPolicy { policy_id, .. }
            | AuthReason::AllowedByResourceGroupUserPolicy { policy_id, .. }
            | AuthReason::AllowedByResourceGroupUserGroupPolicy { policy_id, .. }
            | AuthReason::DeniedByPubliclyAccessible { policy_id }
            | AuthReason::DeniedByServerAccessible { policy_id }
            | AuthReason::DeniedByDirectUserPolicy { policy_id }
            | AuthReason::DeniedByDirectUserGroupPolicy { policy_id, .. }
            | AuthReason::DeniedByResourceGroupUserPolicy { policy_id, .. }
            | AuthReason::DeniedByResourceGroupUserGroupPolicy { policy_id, .. } => {
                Some(*policy_id)
            }
        }
    }
}

/// Per-resource outcome — one of these per resource the caller asked
/// about. Type-level checks (where the policy is "may you create a
/// resource of type T?" with no specific resource id) carry
/// `resource_id = None`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct AuthEvaluation {
    pub resource_id: Option<Uuid>,
    pub is_allowed: bool,
    pub reason: AuthReason,
}

/// The aggregated answer for a single `check_access` call. `access_granted`
/// is true iff every evaluation allowed. Per-resource detail in
/// `evaluations` so the audit log and the "why was I denied?" UI can
/// be specific.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn uuid() -> Uuid {
        Uuid::from_u128(0xdead_beef_0000_0000_0000_0000_0000_0001)
    }

    #[test]
    fn is_allow_partitions_variants() {
        let p = uuid();
        // Spot-check both sides of the partition.
        assert!(AuthReason::SuperAdmin.is_allow());
        assert!(AuthReason::Owned.is_allow());
        assert!(AuthReason::AllowedByPubliclyAccessible { policy_id: p }.is_allow());
        assert!(AuthReason::AllowedByDirectUserGroupPolicy {
            policy_id: p,
            via_user_group_id: p
        }
        .is_allow());
        assert!(!AuthReason::DeniedByPubliclyAccessible { policy_id: p }.is_allow());
        assert!(!AuthReason::NoMatchingAllowPolicy.is_allow());
        assert!(!AuthReason::ResourceNotFound.is_allow());
    }

    #[test]
    fn via_policy_id_returns_none_for_owner_shortcuts() {
        assert_eq!(AuthReason::SuperAdmin.via_policy_id(), None);
        assert_eq!(AuthReason::Owned.via_policy_id(), None);
        assert_eq!(AuthReason::NoMatchingAllowPolicy.via_policy_id(), None);
        assert_eq!(AuthReason::ResourceNotFound.via_policy_id(), None);
    }

    #[test]
    fn via_policy_id_returns_the_policy_for_evidence_variants() {
        let p = uuid();
        let g = Uuid::from_u128(0xcafe);
        let rg = Uuid::from_u128(0xbeef);
        assert_eq!(
            AuthReason::AllowedByPubliclyAccessible { policy_id: p }.via_policy_id(),
            Some(p)
        );
        assert_eq!(
            AuthReason::DeniedByResourceGroupUserGroupPolicy {
                policy_id: p,
                via_user_group_id: g,
                on_resource_group_id: rg,
            }
            .via_policy_id(),
            Some(p)
        );
    }

    #[test]
    fn auth_result_aggregates_evaluations() {
        let p = uuid();
        let r1 = Uuid::from_u128(1);
        let r2 = Uuid::from_u128(2);
        let result = AuthResult {
            access_granted: true,
            evaluations: vec![
                AuthEvaluation {
                    resource_id: Some(r1),
                    is_allowed: true,
                    reason: AuthReason::AllowedByDirectUserPolicy { policy_id: p },
                },
                AuthEvaluation {
                    resource_id: Some(r2),
                    is_allowed: true,
                    reason: AuthReason::Owned,
                },
            ],
        };
        assert!(result.is_allowed());
        assert!(!result.is_denied());
    }

    #[test]
    fn auth_reason_json_uses_pascal_case_variant_names() {
        // Wire-format guard — these strings appear in OpenAPI specs
        // and persist into audit-log rows. A future PR that adds
        // `#[serde(rename_all)]` would silently change the column
        // contents.
        let p = uuid();
        assert_eq!(
            serde_json::to_value(AuthReason::SuperAdmin).unwrap(),
            serde_json::json!("SuperAdmin")
        );
        assert_eq!(
            serde_json::to_value(AuthReason::Owned).unwrap(),
            serde_json::json!("Owned")
        );
        assert_eq!(
            serde_json::to_value(AuthReason::AllowedByPubliclyAccessible { policy_id: p })
                .unwrap(),
            serde_json::json!({"AllowedByPubliclyAccessible": {"policy_id": p}})
        );
    }
}
