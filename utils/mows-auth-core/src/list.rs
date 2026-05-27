//! `list_visible_resource_ids` — the listing primitive.
//!
//! Answers the dual question to `check_access`: "given a subject, an
//! app, and an action, which resource ids of this type are *allowed*
//! (after Deny precedence) right now?"
//!
//! Phase-1 shape (this file): a thin allow-minus-deny fold over the
//! flat `Vec<(Uuid, Effect)>` the store returns from
//! [`crate::PolicyStore::list_visible_resource_ids`]. The store batches
//! every access source — owner-table rows, direct policies, resource-
//! group policies, owner-scoped policies — into one call so we make
//! one round trip per listing.
//!
//! Phase-3 shape (per LISTING.md §3 + §8): the store returns sorted
//! cursors over `(sort_key, resource_id)` per access source and the
//! engine does k-way merge with keyset pagination. The interface
//! contract here (`Subject` + `AppView` + `action` in, allowed ids
//! out) does not change — only the body of this function and the
//! store method signature shift to the cursor model.
//!
//! Cover tables (LISTING.md §6) plug in at the **store** layer in
//! Phase 2 (P2-5) — `list_visible_resource_ids` will read from
//! `public_resources` / `server_member_resources` / large
//! `user_group_accessible_resources` instead of joining
//! `access_policies` for those subjects. The engine signature stays
//! identical.

use std::collections::HashSet;

use uuid::Uuid;

use crate::{
    policies::{AppView, PolicyStore, Subject},
    registry::ResourceAuthInfo,
    types::{AuthError, Effect},
};

/// Return every resource id of this type the subject is allowed to
/// perform `action` on through `app`. Deny precedence applies (a
/// single Deny from any access source wins over any number of
/// Allows).
///
/// The engine never touches a service-specific table — every SQL
/// boundary crosses [`PolicyStore::list_visible_resource_ids`].
#[tracing::instrument(level = "trace", skip(store, auth_info, subject, app))]
pub async fn list_visible_resource_ids<S: PolicyStore + ?Sized>(
    store: &S,
    auth_info: &ResourceAuthInfo,
    subject: &Subject,
    app: AppView,
    action: u32,
) -> Result<Vec<Uuid>, AuthError> {
    let pairs = store
        .list_visible_resource_ids(auth_info, subject, app, action)
        .await?;

    let mut allowed: HashSet<Uuid> = HashSet::new();
    let mut denied: HashSet<Uuid> = HashSet::new();
    for (resource_id, effect) in pairs {
        match effect {
            Effect::Allow => {
                allowed.insert(resource_id);
            }
            Effect::Deny => {
                denied.insert(resource_id);
            }
        }
    }

    Ok(allowed.difference(&denied).copied().collect())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use async_trait::async_trait;
    use uuid::Uuid;

    use super::*;
    use crate::policies::{PolicyView, Subject};

    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn auth_info_for_files() -> ResourceAuthInfo {
        ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: 0,
            group_membership_table: Some("file_file_group_members"),
            group_membership_resource_id_column: Some("file_id"),
            group_membership_group_id_column: Some("file_group_id"),
            resource_group_type: Some(1),
        }
    }

    /// Fixed-response store: returns whatever pairs the test set up.
    #[derive(Debug, Default)]
    struct FixedStore {
        pairs: Vec<(Uuid, Effect)>,
    }

    #[async_trait]
    impl PolicyStore for FixedStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<HashMap<Uuid, Uuid>, AuthError> {
            Ok(HashMap::new())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(HashMap::new())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn list_visible_resource_ids(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<(Uuid, Effect)>, AuthError> {
            Ok(self.pairs.clone())
        }
    }

    fn subject_and_app() -> (Subject, AppView) {
        (
            Subject::user(uuid(10), vec![]),
            AppView {
                id: uuid(99),
                trusted: false,
            },
        )
    }

    #[tokio::test]
    async fn allow_only_pairs_pass_through() {
        let store = FixedStore {
            pairs: vec![(uuid(1), Effect::Allow), (uuid(2), Effect::Allow)],
        };
        let (subject, app) = subject_and_app();
        let mut ids = list_visible_resource_ids(&store, &auth_info_for_files(), &subject, app, 0)
            .await
            .expect("list_visible_resource_ids");
        ids.sort();
        assert_eq!(ids, vec![uuid(1), uuid(2)]);
    }

    #[tokio::test]
    async fn deny_overrides_allow_for_same_resource() {
        // Deny precedence — POLICY_SEMANTICS.md §3 step 5. A single
        // Deny anywhere wins over any number of Allows. The Phase-1
        // fold MUST preserve this; if a future refactor introduces
        // pre-filtering at the store, this test catches the regression.
        let store = FixedStore {
            pairs: vec![
                (uuid(1), Effect::Allow),
                (uuid(1), Effect::Deny),
                (uuid(2), Effect::Allow),
            ],
        };
        let (subject, app) = subject_and_app();
        let ids = list_visible_resource_ids(&store, &auth_info_for_files(), &subject, app, 0)
            .await
            .expect("list_visible_resource_ids");
        assert_eq!(ids, vec![uuid(2)]);
    }

    #[tokio::test]
    async fn deny_only_excludes_the_resource() {
        let store = FixedStore {
            pairs: vec![(uuid(1), Effect::Deny)],
        };
        let (subject, app) = subject_and_app();
        let ids = list_visible_resource_ids(&store, &auth_info_for_files(), &subject, app, 0)
            .await
            .expect("list_visible_resource_ids");
        assert!(ids.is_empty(), "deny-only must not appear in allowed list");
    }

    #[tokio::test]
    async fn empty_store_returns_empty_vec() {
        let store = FixedStore::default();
        let (subject, app) = subject_and_app();
        let ids = list_visible_resource_ids(&store, &auth_info_for_files(), &subject, app, 0)
            .await
            .expect("list_visible_resource_ids");
        assert!(ids.is_empty());
    }
}
