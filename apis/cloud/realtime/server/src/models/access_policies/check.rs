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

#[tracing::instrument(skip(database, requesting_user_groups), level = "trace")]
pub async fn check_resources_access_control(
    database: &Database,
    maybe_requesting_user: Option<&User>,
    requesting_user_groups: &[uuid::Uuid],
    context_app: &MowsApp,
    resource_type: AccessPolicyResourceType,
    maybe_requested_resource_ids: Option<&[uuid::Uuid]>,
    action_to_perform: AccessPolicyAction,
) -> Result<AuthResult, RealtimeError> {
    let resource_auth_info = engine_resource_registry()
        .lookup(resource_type as u32)
        .ok_or_else(|| {
            RealtimeError::AuthCoreError(mows_auth_core::AuthError::Evaluation(format!(
                "resource_type {} not in realtime registry — bootstrap miswire?",
                resource_type as u32
            )))
        })?;

    let subject = subject_from_realtime(maybe_requesting_user, requesting_user_groups);
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

/// Boundary: realtime's user representation → engine's `Subject`.
///
/// `groups` is supplied by the auth middleware, which resolves the
/// caller's `user_user_group_members` rows once per request and
/// hands the result in via `AuthenticationInformation`. Phase 6
/// Round 7 wired this on; before then the field was always empty
/// and UserGroup-subject policies were inert.
///
/// `is_super_admin` is always false for now; realtime doesn't ship
/// a super-admin role until the cluster-wide identity story
/// crystalises.
pub fn subject_from_realtime(
    user: Option<&User>,
    groups: &[uuid::Uuid],
) -> mows_auth_core::Subject {
    match user {
        None => mows_auth_core::Subject::Anonymous,
        Some(u) => mows_auth_core::Subject::User {
            user_id: u.id.0,
            groups: groups.to_vec(),
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
        let s = subject_from_realtime(None, &[]);
        matches!(s, mows_auth_core::Subject::Anonymous);
    }

    #[test]
    fn user_subject_carries_groups() {
        // Phase 6 Round 7 regression: when the middleware resolves a
        // caller's group memberships, they flow through into the
        // engine's Subject so UserGroup-subject policies match.
        use crate::models::users::UserId;
        let now = chrono::Utc::now().naive_utc();
        let u = User {
            id: UserId(uuid::Uuid::from_u128(0xA)),
            external_user_id: None,
            display_name: "alice".to_string(),
            created_time: now,
            modified_time: now,
            deleted: false,
            user_type: 0,
            idp_id: uuid::Uuid::from_u128(0xB),
        };
        let g1 = uuid::Uuid::from_u128(0xC);
        let g2 = uuid::Uuid::from_u128(0xD);
        let s = subject_from_realtime(Some(&u), &[g1, g2]);
        match s {
            mows_auth_core::Subject::User { user_id, groups, is_super_admin } => {
                assert_eq!(user_id, uuid::Uuid::from_u128(0xA));
                assert_eq!(groups, vec![g1, g2]);
                assert!(!is_super_admin);
            }
            _ => panic!("expected Subject::User"),
        }
    }
}
