//! `check_access` — the per-resource auth primitive.
//!
//! Mirrors POLICY_SEMANTICS.md §3 exactly. Every Allow / Deny decision
//! returns an `AuthReason` carrying the policy id when applicable so
//! audits and "why was I denied?" UI never have to guess.
//!
//! Phase 1 ports the logic from
//! `apis/cloud/filez/server/src/models/access_policies/check.rs`
//! (with ARCH-1 + ARCH-11 fixed pre-extraction) and adds the
//! `OwnedByOwner` / `AccessibleByOwner` scope extensions per
//! POLICY_SEMANTICS.md §4.

use crate::types::AuthError;

/// Phase-1 placeholder: real implementation lands when the filez
/// modules move here. Always returns `Denied` so any accidental call
/// before extraction fails closed.
#[tracing::instrument(level = "trace")]
pub fn check_access() -> Result<(), AuthError> {
    Err(AuthError::Evaluation(
        "check_access not yet implemented — see ROADMAP.md Phase 1".to_string(),
    ))
}
