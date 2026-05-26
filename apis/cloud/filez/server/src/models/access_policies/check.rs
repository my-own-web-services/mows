use super::{AccessPolicyAction, AccessPolicyResourceType};
use crate::database::Database;
use crate::errors::FilezError;
use crate::models::apps::MowsApp;
use crate::models::user_groups::UserGroupId;
use crate::models::users::{FilezUser, FilezUserType};
use mows_auth_core::ResourceTypeRegistry;

/// Thin filez wrapper around `mows_auth_core::check_access`.
///
/// The engine owns the precedence rules and policy evaluation; filez
/// supplies the storage backing (via `FilezPolicyStore`) plus the
/// boundary conversions (`subject_from_filez`, `AppView` from
/// `MowsApp`, action enum to `u32`). The old 500-line body that used
/// to live here moved into `mows_auth_core::check` in Cleanup-6.
#[tracing::instrument(skip(database), level = "trace")]
pub async fn check_resources_access_control(
    database: &Database,
    maybe_requesting_user: Option<&FilezUser>,
    maybe_user_group_ids: Option<&Vec<UserGroupId>>,
    context_app: &MowsApp,
    resource_type: AccessPolicyResourceType,
    maybe_requested_resource_ids: Option<&[uuid::Uuid]>,
    action_to_perform: AccessPolicyAction,
) -> Result<AuthResult, FilezError> {
    let resource_auth_info = engine_resource_registry()
        .lookup(resource_type as u32)
        .expect("resource type registered in engine registry");

    let subject = subject_from_filez(maybe_requesting_user, maybe_user_group_ids);
    let app = mows_auth_core::AppView {
        id: context_app.id.0.into(),
        trusted: context_app.trusted,
    };
    let store = super::store::FilezPolicyStore::new(
        database,
        maybe_requesting_user,
        maybe_user_group_ids,
    );

    Ok(mows_auth_core::check_access(
        &store,
        resource_auth_info,
        &subject,
        app,
        action_to_perform as u32,
        maybe_requested_resource_ids,
    )
    .await?)
}

// ---- end of the public check_resources_access_control wrapper ----
//
// What follows used to be ~500 lines of inline evaluation logic. It
// now lives in `mows_auth_core::check::check_access`. The remaining
// items in this file are:
//   * `engine_resource_registry()` (the registry singleton)
//   * `subject_from_filez()` (boundary helper)
//   * the `tests` module (Deny-mapping regression tests — still
//     useful because the engine's reason mapping is identical in
//     spirit to what these tests pin)
//
// `deny_reason_direct` / `deny_reason_via_resource_group` / their
// Allow counterparts moved with the body. The local versions stay
// only because the regression tests still call them — see below.

#[allow(dead_code)]
fn _placeholder_to_anchor_old_code_removal() {
    // Pure marker so a future reader greps for "Cleanup-6 boundary"
    // and lands here.
    // Cleanup-6 boundary: check_access body extracted to mows_auth_core.
}


// AuthReason and AuthEvaluation are engine-owned (mows_auth_core::evaluation).
// Re-exported under their short names so the existing function bodies below
// can keep using `AuthReason::Variant` and `AuthEvaluation { … }` literals
// without a deep import path. These are NOT aliases of a local type — they
// are the engine's canonical types.
pub use mows_auth_core::{AuthEvaluation, AuthReason};

// Filez's local ResourceAuthInfo struct + get_auth_params_for_resource_type
// function were deleted in Cleanup-5. The 9 resource-type entries live
// inline in `engine_resource_registry()` below and are looked up via
// the engine's StaticResourceTypeRegistry trait — single source of
// truth, SQL-identifier validation at boot, no parallel data.

// AuthResult is engine-owned. Re-exported here so existing call sites
// keep their short import path. `verify()` and `verify_allow_type_level()`
// live as an extension trait on the engine type — see
// `crate::errors::AuthResultExt`.
pub use mows_auth_core::AuthResult;

/// Convert filez's `(Option<&FilezUser>, Option<&Vec<UserGroupId>>)`
/// pair — the exact shape `check_resources_access_control` accepts
/// today — into the engine's `Subject`. Used at the boundary when
/// filez handlers call into mows-auth-core: filez resolves group
/// memberships, builds the Subject, then hands it to the engine.
///
/// `is_super_admin` is set from filez's `FilezUserType::SuperAdmin`
/// so the engine's super-admin shortcut fires without filez having
/// to special-case it before the call.
pub fn subject_from_filez(
    user: Option<&FilezUser>,
    groups: Option<&Vec<UserGroupId>>,
) -> mows_auth_core::Subject {
    match user {
        None => mows_auth_core::Subject::Anonymous,
        Some(u) => mows_auth_core::Subject::User {
            user_id: u.id.0.into(),
            groups: groups
                .map(|gs| gs.iter().map(|g| g.0.into()).collect())
                .unwrap_or_default(),
            is_super_admin: u.user_type == FilezUserType::SuperAdmin,
        },
    }
}

// `deny_reason_direct` + `deny_reason_via_resource_group` helpers
// moved into the engine (`mows_auth_core::check`) along with their 6
// regression tests. The engine's tests pin the exact same behaviour
// — see `mows-auth-core/src/check.rs::tests::direct_deny_overrides_owner_grant`
// for the Public+Deny coverage and the per-variant matchers.

/// Build a `mows_auth_core::StaticResourceTypeRegistry` from the same
/// data filez's local `get_auth_params_for_resource_type` returns.
/// Today this only delivers boot-time SQL-identifier-injection
/// validation — when `check_access` moves to the engine it becomes the
/// canonical source and the local function disappears.
///
/// The registry is built once via `OnceLock`; if any identifier fails
/// validation, the process panics at first access. That's correct:
/// the alternative is letting a service boot with a bad table name
/// that would later get spliced into `EXECUTE format()` SQL.
pub fn engine_resource_registry() -> &'static mows_auth_core::StaticResourceTypeRegistry {
    static REGISTRY: std::sync::OnceLock<mows_auth_core::StaticResourceTypeRegistry> =
        std::sync::OnceLock::new();
    REGISTRY.get_or_init(|| {
        // 9 inline entries. Adding a 10th means: extend
        // `AccessPolicyResourceType` (with explicit discriminant) and
        // its `from_u32` match arm in mod.rs, add an entry here, and
        // — if you want SQL-identifier injection coverage from day 1
        // — the registry_validation test below will exercise the
        // lookup path.
        let file = mows_auth_core::ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: AccessPolicyResourceType::File as u32,
            group_membership_table: Some("file_file_group_members"),
            group_membership_resource_id_column: Some("file_id"),
            group_membership_group_id_column: Some("file_group_id"),
            resource_group_type: Some(AccessPolicyResourceType::FileGroup as u32),
        };
        let plain = |rt: AccessPolicyResourceType, table: &'static str, owner_col: Option<&'static str>| {
            mows_auth_core::ResourceAuthInfo {
                resource_table: table,
                resource_table_id_column: "id",
                resource_table_owner_column: owner_col,
                resource_type: rt as u32,
                group_membership_table: None,
                group_membership_resource_id_column: None,
                group_membership_group_id_column: None,
                resource_group_type: None,
            }
        };
        let entries = vec![
            file,
            plain(AccessPolicyResourceType::FileGroup, "file_groups", Some("owner_id")),
            plain(AccessPolicyResourceType::User, "users", Some("id")),
            plain(AccessPolicyResourceType::UserGroup, "user_groups", Some("owner_id")),
            plain(AccessPolicyResourceType::StorageLocation, "storage_locations", None),
            plain(AccessPolicyResourceType::AccessPolicy, "access_policies", Some("owner_id")),
            plain(AccessPolicyResourceType::StorageQuota, "storage_quotas", Some("owner_id")),
            plain(AccessPolicyResourceType::FilezJob, "jobs", Some("owner_id")),
            plain(AccessPolicyResourceType::MowsApp, "apps", None),
        ];
        mows_auth_core::StaticResourceTypeRegistry::new(entries)
            .expect("filez resource registry has unsafe SQL identifiers — see RegistryError")
    })
}

#[cfg(test)]
mod registry_validation {
    //! Boot-time guard: filez's 9 resource types must construct a
    //! valid engine registry. If anyone introduces a new
    //! AccessPolicyResourceType with a bad identifier (e.g.
    //! "files-table" or a quoted-identifier shape) the test fails
    //! before the binary ships.
    use super::engine_resource_registry;
    use crate::models::access_policies::AccessPolicyResourceType;
    use mows_auth_core::ResourceTypeRegistry;

    #[test]
    fn filez_registry_builds_without_unsafe_identifiers() {
        let reg = engine_resource_registry();
        // Spot-check the 9 expected entries are present.
        assert!(reg.lookup(AccessPolicyResourceType::File as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::FileGroup as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::User as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::UserGroup as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::StorageLocation as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::AccessPolicy as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::StorageQuota as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::FilezJob as u32).is_some());
        assert!(reg.lookup(AccessPolicyResourceType::MowsApp as u32).is_some());
        assert_eq!(reg.all().len(), 9, "expected all 9 filez resource types");
        // Lookup of an unregistered integer must return None — guards
        // against silent default-allow if an Action references a
        // type-int that hasn't been registered.
        assert!(reg.lookup(999).is_none());
    }

    #[test]
    fn file_entry_has_correct_group_membership_wiring() {
        let reg = engine_resource_registry();
        let file = reg
            .lookup(AccessPolicyResourceType::File as u32)
            .expect("File registered");
        assert_eq!(file.resource_table, "files");
        assert_eq!(file.resource_table_owner_column, Some("owner_id"));
        assert_eq!(file.group_membership_table, Some("file_file_group_members"));
        assert_eq!(file.resource_group_type, Some(AccessPolicyResourceType::FileGroup as u32));
    }
}

#[cfg(test)]
mod boundary_helpers {
    //! Tests for the filez↔engine boundary helpers. The
    //! AuthReason/AuthEvaluation/AuthResult roundtrip tests that used
    //! to live here are gone — those types ARE the engine types now,
    //! no roundtrip to test. What remains:
    //!   * subject_from_filez (3 cases — anonymous, regular user,
    //!     SuperAdmin) — the only filez-specific conversion left.
    //!   * AccessPolicy → PolicyView preserves all 4 ids (the only
    //!     compile-check-resistant drift target).
    use super::*;
    use crate::models::access_policies::{
        AccessPolicy, AccessPolicyId, Effect, SubjectType,
    };
    use crate::models::user_groups::UserGroupId;
    use crate::models::users::FilezUserId;
    use uuid::Uuid;

    #[test]
    fn subject_from_filez_anonymous() {
        let s = super::subject_from_filez(None, None);
        assert_eq!(s, mows_auth_core::Subject::Anonymous);
    }

    #[test]
    fn subject_from_filez_user_with_groups() {
        use crate::models::users::FilezUserType;
        use chrono::NaiveDateTime;
        let user_uuid = Uuid::new_v4();
        let group_uuid = Uuid::new_v4();
        let user = FilezUser {
            id: crate::models::users::FilezUserId(user_uuid.into()),
            external_user_id: Some("sub-abc".to_string()),
            pre_identifier_email: None,
            display_name: "Test".to_string(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            deleted: false,
            profile_picture: None,
            created_by: None,
            user_type: FilezUserType::Regular,
            idp_id: mows_auth_core::ZITADEL_IDP_ID,
        };
        let groups = vec![UserGroupId(group_uuid.into())];
        let s = super::subject_from_filez(Some(&user), Some(&groups));
        match s {
            mows_auth_core::Subject::User {
                user_id,
                groups,
                is_super_admin,
            } => {
                assert_eq!(user_id, user_uuid);
                assert_eq!(groups, vec![group_uuid]);
                assert!(
                    !is_super_admin,
                    "Regular user must NOT be promoted to SuperAdmin"
                );
            }
            other => panic!("expected Subject::User, got {other:?}"),
        }
    }

    #[test]
    fn subject_from_filez_super_admin_sets_flag() {
        use crate::models::users::FilezUserType;
        use chrono::NaiveDateTime;
        let user = FilezUser {
            id: crate::models::users::FilezUserId(Uuid::new_v4().into()),
            external_user_id: None,
            pre_identifier_email: None,
            display_name: "Admin".to_string(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            deleted: false,
            profile_picture: None,
            created_by: None,
            user_type: FilezUserType::SuperAdmin,
            idp_id: mows_auth_core::ZITADEL_IDP_ID,
        };
        let s = super::subject_from_filez(Some(&user), None);
        match s {
            mows_auth_core::Subject::User { is_super_admin, groups, .. } => {
                assert!(is_super_admin, "SuperAdmin user must set the flag");
                assert!(groups.is_empty(), "None groups must yield empty Vec");
            }
            other => panic!("expected Subject::User, got {other:?}"),
        }
    }

    #[test]
    fn access_policy_to_policy_view_preserves_ids() {
        use crate::models::access_policies::{AccessPolicyAction, AccessPolicyResourceType};
        use crate::models::apps::MowsAppId;
        use chrono::NaiveDateTime;
        let policy_uuid = Uuid::new_v4();
        let subject_uuid = Uuid::new_v4();
        let policy = AccessPolicy {
            id: AccessPolicyId(policy_uuid.into()),
            name: "test".to_string(),
            owner_id: FilezUserId::nil(),
            created_time: NaiveDateTime::default(),
            modified_time: NaiveDateTime::default(),
            subject_type: SubjectType::UserGroup,
            subject_id: crate::models::access_policies::AccessPolicySubjectId(subject_uuid.into()),
            context_app_ids: vec![MowsAppId::nil()],
            resource_type: AccessPolicyResourceType::File,
            resource_id: None,
            actions: vec![AccessPolicyAction::FilezFilesGet],
            effect: Effect::Deny,
        };
        let view: mows_auth_core::PolicyView = (&policy).into();
        assert_eq!(view.id, policy_uuid);
        assert_eq!(view.subject_id, subject_uuid);
        assert_eq!(view.effect, mows_auth_core::types::Effect::Deny);
        assert_eq!(view.subject_type, mows_auth_core::types::SubjectType::UserGroup);
    }
}
