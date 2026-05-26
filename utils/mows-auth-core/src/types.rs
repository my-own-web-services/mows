//! Core types: id newtypes, the policy-evaluation enums, and the typed
//! error returned by every public function.
//!
//! See DATA_MODEL.md §6 for the rationale on each enum's integer
//! representation; the integers are stable wire values stored in
//! Postgres `SMALLINT` / `INT` columns and must not be renumbered.

use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, sql_types::SmallInt,
};
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Conversion error returned when an integer in the database does not match
/// any variant of an engine enum. Scoped to this crate — services wrap it
/// in their own error type via the `AuthError::EnumConversion` variant.
#[derive(Debug, thiserror::Error)]
#[error("invalid enum value in mows_auth column: {msg}")]
pub struct AuthEnumError {
    pub msg: String,
}

impl AuthEnumError {
    pub fn invalid_type_log(msg: String) -> Self {
        AuthEnumError { msg }
    }
}

/// Subject of an access policy — *who* the policy grants/denies to.
///
/// The integer values are wire-stable per DATA_MODEL.md and must match
/// the `subject_type` column.
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema,
    AsExpression, FromSqlRow, DbEnum,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = AuthEnumError::invalid_type_log)]
#[diesel_enum(error_type = AuthEnumError)]
#[repr(i16)]
pub enum SubjectType {
    User = 0,
    UserGroup = 1,
    ServerMember = 2,
    Public = 3,
}

/// Policy outcome — Deny always wins over Allow (POLICY_SEMANTICS.md §3).
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema,
    AsExpression, FromSqlRow, DbEnum,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = AuthEnumError::invalid_type_log)]
#[diesel_enum(error_type = AuthEnumError)]
#[repr(i16)]
pub enum Effect {
    Deny = 0,
    Allow = 1,
}

/// How broadly a policy applies — see DATA_MODEL.md §2.4 and
/// POLICY_SEMANTICS.md §4.
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema,
    AsExpression, FromSqlRow, DbEnum,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = AuthEnumError::invalid_type_log)]
#[diesel_enum(error_type = AuthEnumError)]
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
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema,
    AsExpression, FromSqlRow, DbEnum,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = AuthEnumError::invalid_type_log)]
#[diesel_enum(error_type = AuthEnumError)]
#[repr(i16)]
pub enum GroupVisibility {
    Private = 0,
    ListedRestricted = 1,
    Public = 2,
}

/// User-group join policy axis (USER_GROUPS.md §1).
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema,
    AsExpression, FromSqlRow, DbEnum,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = AuthEnumError::invalid_type_log)]
#[diesel_enum(error_type = AuthEnumError)]
#[repr(i16)]
pub enum GroupJoinPolicy {
    InviteOnly = 0,
    RequestToJoin = 1,
    OpenJoin = 2,
}

/// Listing scope — which slice of "things I can see" the caller wants.
///
/// This is an API parameter, not a column type — no diesel derives.
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

    #[error("invalid enum value in mows_auth column: {0}")]
    EnumConversion(#[from] AuthEnumError),

    #[error("auth evaluation: {0}")]
    Evaluation(String),

    #[error("access denied")]
    Denied,
}

#[cfg(test)]
mod wire_stable_values {
    //! These integer values are persisted in `mows_auth.*` columns. Reordering
    //! a variant (or inserting a new one in the middle) silently corrupts
    //! every existing row — e.g. turning `Effect::Deny` into `Effect::Allow`
    //! across the whole policy table. The tests below pin the values so a
    //! change requires a deliberate edit here too.
    use super::*;

    #[test]
    fn subject_type_values_are_stable() {
        assert_eq!(SubjectType::User         as i16, 0);
        assert_eq!(SubjectType::UserGroup    as i16, 1);
        assert_eq!(SubjectType::ServerMember as i16, 2);
        assert_eq!(SubjectType::Public       as i16, 3);
    }

    #[test]
    fn effect_values_are_stable() {
        assert_eq!(Effect::Deny  as i16, 0);
        assert_eq!(Effect::Allow as i16, 1);
    }

    #[test]
    fn resource_scope_values_are_stable() {
        assert_eq!(ResourceScope::Single            as i16, 0);
        assert_eq!(ResourceScope::OwnedByOwner      as i16, 1);
        assert_eq!(ResourceScope::AccessibleByOwner as i16, 2);
    }

    #[test]
    fn group_visibility_values_are_stable() {
        assert_eq!(GroupVisibility::Private          as i16, 0);
        assert_eq!(GroupVisibility::ListedRestricted as i16, 1);
        assert_eq!(GroupVisibility::Public           as i16, 2);
    }

    #[test]
    fn group_join_policy_values_are_stable() {
        assert_eq!(GroupJoinPolicy::InviteOnly    as i16, 0);
        assert_eq!(GroupJoinPolicy::RequestToJoin as i16, 1);
        assert_eq!(GroupJoinPolicy::OpenJoin      as i16, 2);
    }

    #[test]
    fn list_scope_values_are_stable() {
        assert_eq!(ListScope::Owned  as i16, 0);
        assert_eq!(ListScope::All    as i16, 1);
        assert_eq!(ListScope::Shared as i16, 2);
    }
}
