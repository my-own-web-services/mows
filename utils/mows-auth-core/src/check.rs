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
/// modules move here.
///
/// Visibility deliberately `pub(crate)` and the body returns
/// `AuthError::Denied` (not `Evaluation`) so:
///   * downstream services cannot accidentally wire this stub up via
///     `mows_auth_core::check_access` — the symbol is invisible
///     outside the crate until the real implementation lands,
///   * even a misuse-within-the-crate that swallows the error fails
///     CLOSED (Denied), not open (the previous `Evaluation` mapped to
///     500 in filez but a careless `if check_access().is_ok()`
///     pattern would still grant access).
#[allow(dead_code)] // stub; intentionally uncalled until the real impl lands
pub(crate) fn check_access() -> Result<(), AuthError> {
    Err(AuthError::Denied)
}
