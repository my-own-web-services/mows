//! Thin wrapper around `mows_auth_core::check_access` for chat
//! handlers.
//!
//! The engine owns precedence + evaluation; chat supplies the
//! `PolicyStore` impl (`super::store::RealtimePolicyStore`) plus the
//! boundary conversions. Mirrors filez's `check_resources_access_control`
//! shape so a future shared crate can subsume both.

use mows_auth_core::ResourceTypeRegistry;

use super::{AccessPolicyAction, AccessPolicyResourceType};
use crate::{
    database::Database, errors::RealtimeError, models::apps::MowsApp, models::users::User,
};

pub use mows_auth_core::AuthResult;

#[tracing::instrument(skip(database), level = "trace")]
pub async fn check_resources_access_control(
    database: &Database,
    maybe_requesting_user: Option<&User>,
    context_app: &MowsApp,
    resource_type: AccessPolicyResourceType,
    maybe_requested_resource_ids: Option<&[uuid::Uuid]>,
    action_to_perform: AccessPolicyAction,
) -> Result<AuthResult, RealtimeError> {
    let resource_auth_info = engine_resource_registry()
        .lookup(resource_type as u32)
        .ok_or_else(|| {
            RealtimeError::AuthCoreError(mows_auth_core::AuthError::Evaluation(format!(
                "resource_type {} not in chat registry — bootstrap miswire?",
                resource_type as u32
            )))
        })?;

    let subject = subject_from_chat(maybe_requesting_user);
    let app = mows_auth_core::AppView {
        id: context_app.id.0,
        trusted: context_app.trusted,
    };
    let store = super::store::RealtimePolicyStore::new(database);

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

/// Boundary: chat's user representation → engine's `Subject`.
///
/// `groups` is always empty in chat v1 — the user_groups schema
/// lands in Round 4. Until then, UserGroup-subject policies are
/// schematically representable but inert (the engine's WHERE
/// `subject_id = ANY(groups)` matches nothing).
///
/// `is_super_admin` is always false for now; chat doesn't ship a
/// super-admin role until the cluster-wide identity story crystalises.
pub fn subject_from_chat(user: Option<&User>) -> mows_auth_core::Subject {
    match user {
        None => mows_auth_core::Subject::Anonymous,
        Some(u) => mows_auth_core::Subject::User {
            user_id: u.id.0,
            groups: vec![],
            is_super_admin: false,
        },
    }
}

/// Built once via `OnceLock`. The engine reads
/// `ResourceAuthInfo.resource_table` etc. to compose SQL; the
/// identifier validation happens at registry-build time, so a
/// typo in a table name panics at first access instead of
/// splicing into `EXECUTE format()` later.
pub fn engine_resource_registry() -> &'static mows_auth_core::StaticResourceTypeRegistry {
    static REGISTRY: std::sync::OnceLock<mows_auth_core::StaticResourceTypeRegistry> =
        std::sync::OnceLock::new();
    REGISTRY.get_or_init(|| {
        let plain = |rt: AccessPolicyResourceType,
                     table: &'static str,
                     owner_col: Option<&'static str>| {
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
            plain(AccessPolicyResourceType::Channel, "channels", Some("owner_id")),
            plain(AccessPolicyResourceType::User, "users", Some("id")),
            plain(
                AccessPolicyResourceType::AccessPolicy,
                "access_policies",
                Some("owner_id"),
            ),
            plain(AccessPolicyResourceType::MowsApp, "apps", None),
        ];
        mows_auth_core::StaticResourceTypeRegistry::new(entries)
            .expect("chat resource registry has unsafe SQL identifiers — see RegistryError")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_resolves_every_resource_type() {
        for rt in [
            AccessPolicyResourceType::Channel,
            AccessPolicyResourceType::User,
            AccessPolicyResourceType::AccessPolicy,
            AccessPolicyResourceType::MowsApp,
        ] {
            let entry = engine_resource_registry()
                .lookup(rt as u32)
                .expect("every variant registered");
            assert_eq!(entry.resource_type, rt as u32);
        }
    }

    #[test]
    fn resource_type_round_trips_through_u32() {
        for rt in [
            AccessPolicyResourceType::Channel,
            AccessPolicyResourceType::User,
            AccessPolicyResourceType::AccessPolicy,
            AccessPolicyResourceType::MowsApp,
        ] {
            assert_eq!(AccessPolicyResourceType::from_u32(rt as u32), Some(rt));
        }
        assert_eq!(AccessPolicyResourceType::from_u32(999), None);
    }

    #[test]
    fn anonymous_subject_for_no_user() {
        let s = subject_from_chat(None);
        matches!(s, mows_auth_core::Subject::Anonymous);
    }
}
