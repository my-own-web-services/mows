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
/// ROADMAP. Until then, calling this returns an error so consumers
/// don't accidentally use a stub in production.
#[tracing::instrument(level = "trace")]
pub fn list_visible() -> Result<(), AuthError> {
    Err(AuthError::Evaluation(
        "list_visible not yet implemented — see ROADMAP.md Phase 3".to_string(),
    ))
}
