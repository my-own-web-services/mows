//! Core types: id newtypes, the policy-evaluation enums, and the typed
//! error returned by every public function.
//!
//! See DATA_MODEL.md §6 for the rationale on each enum's integer
//! representation; the integers are stable wire values stored in
//! Postgres `SMALLINT` / `INT` columns and must not be renumbered.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Subject of an access policy — *who* the policy grants/denies to.
///
/// The integer values are wire-stable per DATA_MODEL.md and must match
/// the `subject_type` column.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum SubjectType {
    User = 0,
    UserGroup = 1,
    ServerMember = 2,
    Public = 3,
}

/// Policy outcome — Deny always wins over Allow (POLICY_SEMANTICS.md §3).
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum Effect {
    Deny = 0,
    Allow = 1,
}

/// How broadly a policy applies — see DATA_MODEL.md §2.4 and
/// POLICY_SEMANTICS.md §4.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum ResourceScope {
    /// `resource_id` is the literal target (current filez behaviour).
    Single = 0,
    /// Applies to every resource of `resource_type` owned by the policy's owner.
    OwnedByOwner = 1,
    /// Recursively applies to every resource the policy's owner can access
    /// (depth-1 cycle break — POLICY_SEMANTICS.md §4).
    AccessibleByOwner = 2,
}

/// User-group visibility axis (USER_GROUPS.md §1).
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum GroupVisibility {
    Private = 0,
    ListedRestricted = 1,
    Public = 2,
}

/// User-group join policy axis (USER_GROUPS.md §1).
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum GroupJoinPolicy {
    InviteOnly = 0,
    RequestToJoin = 1,
    OpenJoin = 2,
}

/// Listing scope — which slice of "things I can see" the caller wants.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[repr(i16)]
pub enum ListScope {
    /// Only resources owned by the requesting user.
    Owned = 0,
    /// Owned + shared + Public.
    All = 1,
    /// Shared with me + Public; excludes my own.
    Shared = 2,
}

/// Errors returned by the engine. Scoped to this crate; consumers wrap
/// them in their service-specific error type.
#[derive(thiserror::Error, Debug)]
pub enum AuthError {
    #[error("database: {0}")]
    Database(#[from] diesel::result::Error),

    #[error("connection pool: {0}")]
    Pool(#[from] diesel_async::pooled_connection::deadpool::PoolError),

    #[error("resource type {0} not registered")]
    UnknownResourceType(u32),

    #[error("auth evaluation: {0}")]
    Evaluation(String),

    #[error("access denied")]
    Denied,
}
