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

// Compile-time guard: a future "cleanup" PR that drops the explicit
// discriminants would change the wire integers if a variant is
// inserted later. const _ evaluates at build time, before tests run,
// so a missing-discriminant PR cannot pass cargo build. Same pattern
// repeats for every wire-stable enum below.
const _: () = {
    assert!(SubjectType::User         as i16 == 0);
    assert!(SubjectType::UserGroup    as i16 == 1);
    assert!(SubjectType::ServerMember as i16 == 2);
    assert!(SubjectType::Public       as i16 == 3);
};

impl SubjectType {
    /// Stable PascalCase string used to render `SubjectType` into
    /// durable audit_log `metadata` payloads (and any other surface
    /// that needs a wire-stable string form). Adding a variant
    /// requires extending this match — the compiler enforces it,
    /// and the audit_log review R1 / TECH-1 / SLOP-1 pinned the
    /// canon: never use `format!("{:?}", subject_type)` because
    /// Debug output isn't wire-stable across derive changes.
    pub fn as_audit_string(&self) -> &'static str {
        match self {
            SubjectType::User => "User",
            SubjectType::UserGroup => "UserGroup",
            SubjectType::ServerMember => "ServerMember",
            SubjectType::Public => "Public",
        }
    }
}

#[cfg(test)]
mod subject_type_audit_string_guard {
    //! Pin every variant's audit-string spelling. Renaming a
    //! variant must change BOTH the Rust identifier AND the audit
    //! string deliberately — the test rejects accidental drift.
    use super::*;

    #[test]
    fn each_variant_has_a_stable_audit_string() {
        assert_eq!(SubjectType::User.as_audit_string(), "User");
        assert_eq!(SubjectType::UserGroup.as_audit_string(), "UserGroup");
        assert_eq!(SubjectType::ServerMember.as_audit_string(), "ServerMember");
        assert_eq!(SubjectType::Public.as_audit_string(), "Public");
    }
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

const _: () = {
    assert!(Effect::Deny  as i16 == 0);
    assert!(Effect::Allow as i16 == 1);
};

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

const _: () = {
    assert!(ResourceScope::Single            as i16 == 0);
    assert!(ResourceScope::OwnedByOwner      as i16 == 1);
    assert!(ResourceScope::AccessibleByOwner as i16 == 2);
};

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

const _: () = {
    assert!(GroupVisibility::Private          as i16 == 0);
    assert!(GroupVisibility::ListedRestricted as i16 == 1);
    assert!(GroupVisibility::Public           as i16 == 2);
};

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

const _: () = {
    assert!(GroupJoinPolicy::InviteOnly    as i16 == 0);
    assert!(GroupJoinPolicy::RequestToJoin as i16 == 1);
    assert!(GroupJoinPolicy::OpenJoin      as i16 == 2);
};

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

const _: () = {
    assert!(ListScope::Owned  as i16 == 0);
    assert!(ListScope::All    as i16 == 1);
    assert!(ListScope::Shared as i16 == 2);
};

/// Errors returned by the engine. Scoped to this crate; consumers wrap
/// them in their service-specific error type.
///
/// HTTP-status mapping lives on the enum itself (see
/// [`AuthError::http_status`]) so every consuming service translates
/// the same way — no per-service drift in what an engine error means
/// to the client.
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

/// Status codes returned to clients. Numeric representation kept stable
/// so consumers that map this enum to an HTTP framework's status type
/// (axum, actix, …) can do so without depending on a specific
/// framework crate here. Use [`AuthError::http_status`] for mapping.
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
#[repr(u16)]
pub enum AuthHttpStatus {
    /// 403 — the request was understood and authenticated, but the
    /// caller is not allowed to perform the action.
    Forbidden = 403,
    /// 500 — programmer bug (e.g. unregistered resource type, enum
    /// conversion failure, generic evaluation error).
    InternalServerError = 500,
    /// 503 — transient infrastructure failure (DB unreachable, pool
    /// exhausted). Clients should retry.
    ServiceUnavailable = 503,
}

impl AuthError {
    /// Map an engine error to the canonical HTTP status. Single source
    /// of truth — services should delegate here rather than re-deriving
    /// a per-service mapping, so audit and observability stay
    /// consistent across the cluster.
    ///
    /// - `Denied` → 403 (authorization actually said no)
    /// - `Database` / `Pool` → 503 (infra; retriable)
    /// - `UnknownResourceType` / `EnumConversion` / `Evaluation` → 500
    ///   (programmer bug or data corruption; not retriable)
    pub fn http_status(&self) -> AuthHttpStatus {
        match self {
            AuthError::Denied => AuthHttpStatus::Forbidden,
            AuthError::Database(_) | AuthError::Pool(_) => AuthHttpStatus::ServiceUnavailable,
            AuthError::UnknownResourceType(_)
            | AuthError::EnumConversion(_)
            | AuthError::Evaluation(_) => AuthHttpStatus::InternalServerError,
        }
    }
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

#[cfg(test)]
mod json_wire_format {
    //! QA-5: the integer discriminants are the DB wire format; the
    //! variant-name strings are the HTTP / JSON wire format. A
    //! seemingly innocuous `#[serde(rename_all = "snake_case")]` added
    //! to fix a different bug would silently change every external
    //! policy-management client's request shape. Pin the JSON form so
    //! that PR fails immediately.
    use super::*;

    fn jsv(s: &str) -> serde_json::Value {
        serde_json::Value::String(s.to_string())
    }

    #[test]
    fn subject_type_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(SubjectType::User).unwrap(),         jsv("User"));
        assert_eq!(serde_json::to_value(SubjectType::UserGroup).unwrap(),    jsv("UserGroup"));
        assert_eq!(serde_json::to_value(SubjectType::ServerMember).unwrap(), jsv("ServerMember"));
        assert_eq!(serde_json::to_value(SubjectType::Public).unwrap(),       jsv("Public"));
        // Reverse direction too — clients send strings.
        let parsed: SubjectType = serde_json::from_value(jsv("ServerMember")).unwrap();
        assert_eq!(parsed, SubjectType::ServerMember);
    }

    #[test]
    fn effect_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(Effect::Deny).unwrap(),  jsv("Deny"));
        assert_eq!(serde_json::to_value(Effect::Allow).unwrap(), jsv("Allow"));
        let parsed: Effect = serde_json::from_value(jsv("Deny")).unwrap();
        assert_eq!(parsed, Effect::Deny);
    }

    #[test]
    fn resource_scope_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(ResourceScope::Single).unwrap(),            jsv("Single"));
        assert_eq!(serde_json::to_value(ResourceScope::OwnedByOwner).unwrap(),      jsv("OwnedByOwner"));
        assert_eq!(serde_json::to_value(ResourceScope::AccessibleByOwner).unwrap(), jsv("AccessibleByOwner"));
    }

    #[test]
    fn group_visibility_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(GroupVisibility::Private).unwrap(),          jsv("Private"));
        assert_eq!(serde_json::to_value(GroupVisibility::ListedRestricted).unwrap(), jsv("ListedRestricted"));
        assert_eq!(serde_json::to_value(GroupVisibility::Public).unwrap(),           jsv("Public"));
    }

    #[test]
    fn group_join_policy_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(GroupJoinPolicy::InviteOnly).unwrap(),    jsv("InviteOnly"));
        assert_eq!(serde_json::to_value(GroupJoinPolicy::RequestToJoin).unwrap(), jsv("RequestToJoin"));
        assert_eq!(serde_json::to_value(GroupJoinPolicy::OpenJoin).unwrap(),      jsv("OpenJoin"));
    }

    #[test]
    fn list_scope_json_uses_pascal_case_variant_names() {
        assert_eq!(serde_json::to_value(ListScope::Owned).unwrap(),  jsv("Owned"));
        assert_eq!(serde_json::to_value(ListScope::All).unwrap(),    jsv("All"));
        assert_eq!(serde_json::to_value(ListScope::Shared).unwrap(), jsv("Shared"));
    }
}

#[cfg(test)]
mod openapi_schema_shape {
    //! Pin the OpenAPI schema shape for every wire-stable enum. The
    //! actual serde wire format is the PascalCase variant name (see
    //! `json_wire_format` above), so the generated schema must say
    //! `type: string, enum: ["Variant", …]` — never `type: integer`.
    //!
    //! Regression context: utoipa's `repr` feature, when enabled,
    //! infers an integer schema from `#[repr(i16)]` even though serde
    //! still serialises variant names. The repr feature was enabled in
    //! a 2026-05-26 refactor; the resulting openapi.json drift then
    //! made the TS codegen emit useless `Value0` / `Value1` enum
    //! members. Cargo.toml now omits the feature; this test pins the
    //! observable schema so a future re-enable fails immediately.
    use super::*;
    use utoipa::PartialSchema;

    fn schema_value<S: PartialSchema>() -> serde_json::Value {
        serde_json::to_value(S::schema()).unwrap()
    }

    fn assert_string_enum(value: &serde_json::Value, expected: &[&str]) {
        assert_eq!(value["type"], serde_json::json!("string"),
                   "schema must be `type: string`, got {value:#}");
        let members = value["enum"].as_array().unwrap();
        // A5 (phase4-frontend-review): a utoipa regression that emits
        // mixed string + integer members (e.g. enum: [0, "A", 1, "B"])
        // would pass a `type: string` check alone. Assert every member
        // is genuinely a JSON string so that codegen can never silently
        // round-trip an integer discriminant again.
        for member in members {
            assert!(
                member.is_string(),
                "enum member must be a JSON string, got {member:?}"
            );
        }
        let got: Vec<&str> =
            members.iter().map(|v| v.as_str().unwrap()).collect();
        assert_eq!(got, expected, "enum members differ");
    }

    #[test] fn subject_type_schema_is_string_enum() {
        assert_string_enum(&schema_value::<SubjectType>(),
            &["User", "UserGroup", "ServerMember", "Public"]);
    }

    #[test] fn effect_schema_is_string_enum() {
        assert_string_enum(&schema_value::<Effect>(), &["Deny", "Allow"]);
    }

    #[test] fn resource_scope_schema_is_string_enum() {
        assert_string_enum(&schema_value::<ResourceScope>(),
            &["Single", "OwnedByOwner", "AccessibleByOwner"]);
    }

    #[test] fn group_visibility_schema_is_string_enum() {
        assert_string_enum(&schema_value::<GroupVisibility>(),
            &["Private", "ListedRestricted", "Public"]);
    }

    #[test] fn group_join_policy_schema_is_string_enum() {
        assert_string_enum(&schema_value::<GroupJoinPolicy>(),
            &["InviteOnly", "RequestToJoin", "OpenJoin"]);
    }

    #[test] fn list_scope_schema_is_string_enum() {
        assert_string_enum(&schema_value::<ListScope>(),
            &["Owned", "All", "Shared"]);
    }
}

#[cfg(test)]
mod http_status_mapping {
    //! ARCH-6: every consuming service maps AuthError to HTTP the same
    //! way by delegating here. The numeric values are intentionally
    //! framework-agnostic.
    use super::*;

    #[test]
    fn denied_is_403() {
        assert_eq!(AuthError::Denied.http_status(), AuthHttpStatus::Forbidden);
        assert_eq!(AuthHttpStatus::Forbidden as u16, 403);
    }

    #[test]
    fn database_and_pool_are_503() {
        assert_eq!(
            AuthError::Database(diesel::result::Error::NotFound).http_status(),
            AuthHttpStatus::ServiceUnavailable
        );
        assert_eq!(AuthHttpStatus::ServiceUnavailable as u16, 503);
    }

    #[test]
    fn unknown_resource_type_and_evaluation_are_500() {
        assert_eq!(
            AuthError::UnknownResourceType(42).http_status(),
            AuthHttpStatus::InternalServerError
        );
        assert_eq!(
            AuthError::Evaluation("bug".to_string()).http_status(),
            AuthHttpStatus::InternalServerError
        );
        assert_eq!(
            AuthError::EnumConversion(AuthEnumError::invalid_type_log("x".to_string()))
                .http_status(),
            AuthHttpStatus::InternalServerError
        );
        assert_eq!(AuthHttpStatus::InternalServerError as u16, 500);
    }
}
