//! Access-policy storage shape + the engine-side storage abstraction.
//!
//! `PolicyView` is the minimal projection of an `access_policies` row
//! the engine needs to make a decision — id, effect, subject. Services
//! that hold the full `AccessPolicy` row (with timestamps, names,
//! revoked-flag, etc.) convert to `PolicyView` at the boundary; the
//! engine never sees their extra columns.
//!
//! `Subject` is the principal making the request: a user, an
//! anonymous caller, or anything in between. The engine uses it to
//! filter policies — the user's group memberships are resolved by the
//! service before this struct is built.
//!
//! Phase 1.3 will add the actual `PolicyStore` trait that consumes
//! these types; this commit lands the type vocabulary so the trait
//! design has stable building blocks.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::{Effect, SubjectType};

/// Minimal projection of an `access_policies` row used by
/// `check_access`. The full filez `AccessPolicy` struct has 13+
/// columns; the engine evaluator only consults these four.
///
/// Wire-stable: this struct is serialised into the audit log
/// alongside the corresponding `AuthReason`. Add fields rather than
/// reordering / removing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyView {
    pub id: Uuid,
    pub effect: Effect,
    pub subject_type: SubjectType,
    /// The subject identifier. Semantics depend on `subject_type`:
    ///   - `User` → `mows_auth.users.id`
    ///   - `UserGroup` → `mows_auth.user_groups.id`
    ///   - `ServerMember` / `Public` → the nil UUID (sentinel)
    pub subject_id: Uuid,
}

/// Who is making the request — the input side of the engine.
///
/// The service resolves the user's group memberships *before*
/// building this value (`groups` is the closed set the engine will
/// match `UserGroup` policies against). The engine never queries
/// `user_user_group_members` itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Subject {
    /// No authenticated user. The engine considers only `Public`
    /// policies (and `ServerMember` is treated as not-matching, since
    /// the caller is not a server member).
    Anonymous,

    /// An authenticated user, with their resolved set of group
    /// memberships. Empty `groups` means "no groups" (valid; just no
    /// `UserGroup` policies will match).
    User {
        user_id: Uuid,
        groups: Vec<Uuid>,
        /// SuperAdmin shortcut — when true, the engine returns
        /// `AuthReason::SuperAdmin` for every requested resource
        /// without consulting the policy table.
        is_super_admin: bool,
    },
}

impl Subject {
    /// Convenience constructor for the common case.
    pub fn user(user_id: Uuid, groups: Vec<Uuid>) -> Self {
        Subject::User { user_id, groups, is_super_admin: false }
    }

    /// The user id, when this subject is an authenticated user.
    pub fn user_id(&self) -> Option<Uuid> {
        match self {
            Subject::User { user_id, .. } => Some(*user_id),
            Subject::Anonymous => None,
        }
    }

    pub fn is_anonymous(&self) -> bool {
        matches!(self, Subject::Anonymous)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Effect, SubjectType};

    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn policy_view_round_trips_through_serde() {
        let p = PolicyView {
            id: uuid(1),
            effect: Effect::Allow,
            subject_type: SubjectType::UserGroup,
            subject_id: uuid(2),
        };
        let json = serde_json::to_value(&p).unwrap();
        let back: PolicyView = serde_json::from_value(json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn subject_user_helpers() {
        let s = Subject::user(uuid(10), vec![uuid(20), uuid(21)]);
        assert_eq!(s.user_id(), Some(uuid(10)));
        assert!(!s.is_anonymous());
        match s {
            Subject::User { is_super_admin, groups, .. } => {
                assert!(!is_super_admin);
                assert_eq!(groups.len(), 2);
            }
            _ => panic!("expected User"),
        }
    }

    #[test]
    fn subject_anonymous_helpers() {
        let s = Subject::Anonymous;
        assert_eq!(s.user_id(), None);
        assert!(s.is_anonymous());
    }

    #[test]
    fn subject_super_admin_must_be_set_explicitly() {
        // Regression guard: `Subject::user(...)` is the convenience
        // constructor and must never produce a SuperAdmin by accident.
        // Anyone wanting SuperAdmin uses the struct literal with
        // is_super_admin: true.
        let s = Subject::user(uuid(1), vec![]);
        if let Subject::User { is_super_admin, .. } = s {
            assert!(!is_super_admin, "Subject::user must default is_super_admin to false");
        }
    }
}
