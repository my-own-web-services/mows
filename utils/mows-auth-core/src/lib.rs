//! MOWS authorization engine — `check_access` and `list_visible` primitives,
//! the policy schema, and the per-service extension hooks.
//!
//! See `.plans/authorization/` (in particular ARCHITECTURE.md and
//! DATA_MODEL.md) for the full design and rationale. The crate is consumed
//! in-process by each MOWS service via the service's existing Postgres
//! connection pool; see DEPLOYMENT.md for the topology.
//!
//! ## Crate layout (per DATA_MODEL.md §1)
//!
//! - [`types`]     — id newtypes, enums (`SubjectType`, `Effect`,
//!                   `ResourceScope`, `GroupVisibility`, `GroupJoinPolicy`)
//!                   and the typed [`AuthError`].
//! - [`registry`]  — `ResourceTypeRegistry` trait, how services plug in.
//! - [`check`]     — `check_access(...)` per-resource decision.
//! - [`list`]      — `list_visible(...)` paginated listing.
//! - [`policies`]  — `AccessPolicy` struct + CRUD helpers, the
//!                   `filter_subject_access_policies!` macro.
//! - [`groups`]    — user-group + resource-group helpers.
//! - [`subjects`]  — `MowsUser`, `MowsApp` shared types.
//!
//! Public API surface (per ARCHITECTURE.md §3.7a — the single-primitive rule):
//! every handler calls exactly one of [`check::check_access`] or
//! [`list::list_visible`]. No handler composes auth SQL. Picker / consent
//! mutations go via [`policies`] under a dedicated DB role.

pub mod types;

pub mod registry;

pub mod policies;

pub mod groups;

pub mod subjects;

pub mod idp;

pub mod evaluation;

pub mod check;

pub mod list;

// Re-export the most-used items at the crate root so downstream services
// don't need a deep import path.
//
// `list_visible_resource_ids` is the Phase-1 listing primitive: a thin
// allow-minus-deny fold over a single store call. Phase 3 swaps the
// body for a k-way sorted-stream merge with keyset pagination per
// LISTING.md §3 + §8 — the public signature stays put.
pub use crate::check::check_access;
pub use crate::list::{
    list_visible_resource_ids, merge_streams, merge_streams_with_deny_check,
    DenyChecker, DirectUserGroupStream, DirectUserStream, LargeUserGroupCoverStream,
    ListingCursor, ListingPage, OwnedStream, PolicyStoreDenyChecker, PublicCoverStream,
    ServerMemberCoverStream, SortedStream, StreamItem, StreamSource,
};
pub use crate::evaluation::{AuthEvaluation, AuthReason, AuthResult};
pub use crate::idp::{
    IntrospectedUser, IntrospectionError, IntrospectionResult, TokenIntrospector,
    ZitadelIntrospector, NOBODY_USER_ID, ZITADEL_IDP_ID,
};
pub use crate::policies::{AppView, PolicyStore, PolicyView, Subject};
pub use crate::registry::{
    RegistryError, ResourceAuthInfo, ResourceTypeRegistry, StaticResourceTypeRegistry,
};
pub use crate::types::AuthError;
