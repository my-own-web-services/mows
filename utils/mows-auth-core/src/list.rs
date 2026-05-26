//! `list_visible` — the paginated listing primitive.
//!
//! Implements LISTING.md §3 in three layers:
//! 1. **OwnerOnly fast path** — internal to the primitive, no policy
//!    table touches; the handler sees the same signature.
//! 2. **k-way sorted stream merge** with keyset pagination for
//!    `scope = All | Shared`.
//! 3. **Cover-table reads** for the hot subjects (Public, ServerMember,
//!    large user-groups) — see LISTING.md §6.
//!
//! Phase 1 keeps filez's `get_all_resources_with_user_access` calling
//! the existing in-filez implementation through a thin adapter;
//! Phase 3 replaces it with the full k-way merge per LISTING.md §8 and
//! adds the SLO-gated benchmarks.

use crate::types::AuthError;

/// Phase-1 placeholder: real implementation lands in Phase 3 per
/// ROADMAP.
///
/// Visibility deliberately `pub(crate)` and the body returns
/// `AuthError::Denied` (not `Evaluation`) so:
///   * downstream services cannot accidentally wire this stub up via
///     `mows_auth_core::list_visible` — the symbol is invisible
///     outside the crate until the real implementation lands,
///   * even a misuse-within-the-crate that swallows the error fails
///     CLOSED (Denied), not open.
#[allow(dead_code)] // stub; intentionally uncalled until the real impl lands
pub(crate) fn list_visible() -> Result<(), AuthError> {
    Err(AuthError::Denied)
}
