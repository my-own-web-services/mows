//! Access-policy storage shape + the engine-side storage abstraction.
//!
//! `PolicyView` is the minimal projection of an `access_policies` row
//! the engine needs to make a decision — id, effect, subject. Services
//! that hold the full `AccessPolicy` row (with timestamps, names,
//! revoked-flag, etc.) convert to `PolicyView` at the boundary; the
//! engine never sees their extra columns.
//!
//! `Subject` is the principal making the request: a user, an
//! anonymous caller, or anything in between. The engine uses it to
//! filter policies — the user's group memberships are resolved by the
//! service before this struct is built.
//!
//! Phase 1.3 / Cleanup-6: the `PolicyStore` trait below is the actual
//! storage abstraction `check_access` calls. Filez implements it on a
//! diesel-backed wrapper; a future service implements it on its own
//! schema. The engine's evaluator never touches a specific table.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::registry::ResourceAuthInfo;
use crate::types::{AuthError, Effect, ResourceScope, SubjectType};

/// Minimal projection of an `access_policies` row used by
/// `check_access`. The full filez `AccessPolicy` struct has 13+
/// columns; the engine evaluator only consults these four.
///
/// Wire-stable: this struct is serialised into the audit log
/// alongside the corresponding `AuthReason`. Add fields rather than
/// reordering / removing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyView {
    pub id: Uuid,
    /// Who created this policy. Needed by the engine when evaluating
    /// `resource_scope = OwnedByOwner` policies (the policy applies
    /// to resources whose `owner_id == policy.owner_id`).
    pub owner_id: Uuid,
    pub effect: Effect,
    pub subject_type: SubjectType,
    /// The subject identifier. Semantics depend on `subject_type`:
    ///   - `User` → `mows_auth.users.id`
    ///   - `UserGroup` → `mows_auth.user_groups.id`
    ///   - `ServerMember` / `Public` → the nil UUID (sentinel)
    pub subject_id: Uuid,
    /// How broadly this policy applies (POLICY_SEMANTICS.md §4).
    /// Single = `resource_id` pins the target (historic default).
    /// OwnedByOwner / AccessibleByOwner apply to entire resource sets.
    pub resource_scope: ResourceScope,
}

/// Who is making the request — the input side of the engine.
///
/// The service resolves the user's group memberships *before*
/// building this value (`groups` is the closed set the engine will
/// match `UserGroup` policies against). The engine never queries
/// `user_user_group_members` itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Subject {
    /// No authenticated user. The engine considers only `Public`
    /// policies (and `ServerMember` is treated as not-matching, since
    /// the caller is not a server member).
    Anonymous,

    /// An authenticated user, with their resolved set of group
    /// memberships. Empty `groups` means "no groups" (valid; just no
    /// `UserGroup` policies will match).
    User {
        user_id: Uuid,
        groups: Vec<Uuid>,
        /// SuperAdmin shortcut — when true, the engine returns
        /// `AuthReason::SuperAdmin` for every requested resource
        /// without consulting the policy table.
        is_super_admin: bool,
    },
}

impl Subject {
    /// Convenience constructor for the common case.
    pub fn user(user_id: Uuid, groups: Vec<Uuid>) -> Self {
        Subject::User { user_id, groups, is_super_admin: false }
    }

    /// The user id, when this subject is an authenticated user.
    pub fn user_id(&self) -> Option<Uuid> {
        match self {
            Subject::User { user_id, .. } => Some(*user_id),
            Subject::Anonymous => None,
        }
    }

    pub fn is_anonymous(&self) -> bool {
        matches!(self, Subject::Anonymous)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Effect, SubjectType};

    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn policy_view_round_trips_through_serde() {
        let p = PolicyView {
            id: uuid(1),
            owner_id: uuid(3),
            effect: Effect::Allow,
            subject_type: SubjectType::UserGroup,
            subject_id: uuid(2),
            resource_scope: ResourceScope::Single,
        };
        let json = serde_json::to_value(&p).unwrap();
        let back: PolicyView = serde_json::from_value(json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn subject_user_helpers() {
        let s = Subject::user(uuid(10), vec![uuid(20), uuid(21)]);
        assert_eq!(s.user_id(), Some(uuid(10)));
        assert!(!s.is_anonymous());
        match s {
            Subject::User { is_super_admin, groups, .. } => {
                assert!(!is_super_admin);
                assert_eq!(groups.len(), 2);
            }
            _ => panic!("expected User"),
        }
    }

    #[test]
    fn subject_anonymous_helpers() {
        let s = Subject::Anonymous;
        assert_eq!(s.user_id(), None);
        assert!(s.is_anonymous());
    }

    #[test]
    fn subject_super_admin_must_be_set_explicitly() {
        // Regression guard: `Subject::user(...)` is the convenience
        // constructor and must never produce a SuperAdmin by accident.
        // Anyone wanting SuperAdmin uses the struct literal with
        // is_super_admin: true.
        let s = Subject::user(uuid(1), vec![]);
        if let Subject::User { is_super_admin, .. } = s {
            assert!(!is_super_admin, "Subject::user must default is_super_admin to false");
        }
    }
}

/// The engine's view of the app that's making the request — the
/// context dimension on every policy. Filez builds one of these from
/// its full `MowsApp` row at the boundary.
///
/// `trusted` matters because of the owner-only short-circuit in
/// `check_access`: when a trusted app requests resources entirely
/// owned by the requesting user, the engine returns Allow without
/// consulting the policy table (POLICY_SEMANTICS.md §3 step 4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppView {
    pub id: Uuid,
    pub trusted: bool,
}

/// The storage abstraction `check_access` consumes. Each MOWS service
/// implements this on top of its own database access (filez uses
/// diesel against its `access_policies` table; a future Pektin would
/// use the same pattern against its schema).
///
/// All methods take the resource-registry entry as input so the
/// engine never has to know which table to query — that's filez's
/// (or whoever's) job to translate into a concrete query.
///
/// ## Method semantics
///
/// - `fetch_owners` — given a list of resource ids of type
///   `auth_info.resource_type`, return `(id → owner_id)` mappings.
///   Used for the owner-only shortcut. Resources without an owner
///   column (`auth_info.resource_table_owner_column.is_none()`) MUST
///   return an empty map.
///
/// - `fetch_direct_policies` — policies that apply directly to one
///   of the given resource ids. Filtered by `(subject, app, action,
///   resource_type)`. The store may filter at SQL level or in Rust.
///
/// - `fetch_resource_group_memberships` — for each resource, the
///   resource-group ids it belongs to (via filez's
///   `file_file_group_members` table or equivalent). Empty for
///   resource types without a `group_membership_table`.
///
/// - `fetch_resource_group_policies` — policies that apply to a
///   resource-group (typed as `resource_group_type`) when the
///   subject/app/action match. The engine knows `resource_group_type`
///   from `auth_info.resource_group_type`.
///
/// - `fetch_type_level_policies` — policies with `resource_id IS
///   NULL` (the "may you create *any* resource of this type?"
///   pattern). Filtered by subject/app/action.
///
/// Implementations MUST honour standard policy filtering: respect
/// `context_app_ids @> [app_id]`, `actions @> [action]`, the
/// subject filter (Public/ServerMember/User(user_id)/UserGroup(any
/// in subject's groups)), and any other invariants documented in
/// `POLICY_SEMANTICS.md §3`.
#[async_trait]
pub trait PolicyStore: Send + Sync {
    async fn fetch_owners(
        &self,
        auth_info: &ResourceAuthInfo,
        resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Uuid>, AuthError>;

    async fn fetch_direct_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
        resource_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError>;

    async fn fetch_resource_group_memberships(
        &self,
        auth_info: &ResourceAuthInfo,
        resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<Uuid>>, AuthError>;

    async fn fetch_resource_group_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
        resource_group_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError>;

    async fn fetch_type_level_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<PolicyView>, AuthError>;

    /// Policies with `resource_scope IN (OwnedByOwner, AccessibleByOwner)`
    /// for the given subject/app/action (POLICY_SEMANTICS.md §4). These
    /// have `resource_id IS NULL` and apply to *sets* of resources via
    /// the policy's `owner_id`. The engine matches per-resource via
    /// `policy.owner_id == resource.owner_id` for OwnedByOwner.
    ///
    /// Default returns empty so existing stores keep compiling; stores
    /// that want scope support override this.
    async fn fetch_owner_scoped_policies(
        &self,
        _auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        _app: AppView,
        _action: u32,
    ) -> Result<Vec<PolicyView>, AuthError> {
        Ok(vec![])
    }

    /// Listing-side primitive backing [`crate::list::list_visible_resource_ids`].
    ///
    /// Returns every `(resource_id, effect)` pair that matches the
    /// `subject` × `app` × `action` triple — across **all** access
    /// sources (direct, resource-group, owner-scoped, …) and across
    /// every Allow/Deny combination. The engine collapses the pairs
    /// into the final allow-minus-deny set; the store does NOT pre-
    /// apply Deny precedence so the engine remains the single source
    /// of truth for evaluation semantics.
    ///
    /// Owned-by-the-user rows are also included here when the
    /// auth_info has an `owner_column` — modelled as `(resource_id,
    /// Allow)` pairs so the engine treats ownership and Allow
    /// policies uniformly. Owner-scoped policies use the
    /// `policy.owner_id == resource.owner_id` match per
    /// POLICY_SEMANTICS.md §4 (AccessibleByOwner is deferred — same
    /// cycle-break the check path uses).
    ///
    /// LISTING.md §3 calls out that this Phase-1 shape is a "fetch
    /// everything then diff" implementation — fine at today's scale,
    /// replaced by a k-way sorted merge with keyset pagination in
    /// Phase 3 once the cover tables land (P2-5).
    ///
    /// Default returns empty so existing stores keep compiling; stores
    /// that want listing support override this.
    async fn list_visible_resource_ids(
        &self,
        _auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        _app: AppView,
        _action: u32,
    ) -> Result<Vec<(Uuid, crate::types::Effect)>, AuthError> {
        Ok(vec![])
    }

    /// Phase 3 P3-2 — batched read for the OwnedStream feeding the
    /// k-way merge in [`crate::list::merge_streams`].
    ///
    /// Returns up to `batch_size` resources owned by `user_id`,
    /// ordered `(created_time DESC, resource_id DESC)`, strictly
    /// past the keyset cursor when provided. The Phase-3 listing
    /// engine pulls batches lazily as the merge advances — at most
    /// one batch per stream per page (LISTING.md §5.1).
    ///
    /// Returning fewer than `batch_size` items signals the stream
    /// is exhausted (the caller stops refilling). Returning
    /// `batch_size` items does NOT necessarily mean more exist;
    /// the caller's next call will return empty if so.
    ///
    /// `auth_info.resource_table_owner_column` must be `Some` for
    /// this to return anything; resource types without an owner
    /// (e.g. AccessPolicy itself) return an empty Vec — they
    /// don't participate in the OwnedStream.
    ///
    /// Default fails loud — a store that participates in the
    /// listing engine MUST override. A silent `Ok(vec![])` default
    /// would mean a misimplemented store ships listings that
    /// silently omit every owned resource (phase3-review A1 /
    /// TECH-3 / ARCH-1 / SLOP-3). The engine surfaces
    /// `AuthError::Evaluation` so the failure is loud and
    /// debuggable, not a silent empty list.
    ///
    /// Stores that genuinely don't participate (e.g. a Phase-6 cron
    /// runner that only needs `check_access`) can override with
    /// `Ok(vec![])` explicitly and document the intent.
    async fn stream_owned_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _user_id: &Uuid,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_owned_resources not implemented for this store. \
             Stores participating in the Phase-3 listing engine MUST override \
             this method; opt-out stores must override with an explicit Ok(vec![]).
             phase3-review A1 / TECH-3 / ARCH-1.".to_string(),
        ))
    }

    /// Phase 3 P3-3 — keyset-paginated stream for the
    /// `DirectUserStream`: resources directly shared with a single
    /// user via `subject_type = User, subject_id = $user_id`
    /// policies (LISTING.md §5 table row 1).
    ///
    /// Returns up to `batch_size` items past the cursor, joining
    /// `access_policies` to the resource table on
    /// `resource_id` and sorting by the resource's `created_time
    /// DESC, id DESC`. Filters on:
    ///   - subject_type = User AND subject_id = $user_id
    ///   - effect = Allow
    ///   - actions @> ARRAY[$action]
    ///   - context_app_ids && ARRAY[$app_id, nil_uuid] (any-app
    ///     match)
    ///   - lifecycle: NOT revoked AND expires_at semantics
    ///
    /// `auth_info.resource_table_owner_column` is consulted only
    /// for the resource-side sort key (`created_time`); resources
    /// without that column return empty.
    ///
    /// Default fails loud — same rationale as
    /// `stream_owned_resources`.
    async fn stream_direct_user_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _user_id: &Uuid,
        _app: AppView,
        _action: u32,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_direct_user_resources not implemented for this \
             store. Stores participating in the Phase-3 listing engine MUST \
             override this method; opt-out stores must override with an \
             explicit Ok(vec![]). phase3-review A1.".to_string(),
        ))
    }

    /// Phase 3 P3-3 — keyset-paginated stream for the
    /// `DirectUserGroupStream`: resources shared with ANY of the
    /// caller's user-groups via `subject_type = UserGroup,
    /// subject_id IN ($group_ids)` policies (LISTING.md §5 table
    /// row 2).
    ///
    /// `group_ids` is the closed set of user-groups the caller
    /// belongs to (resolved by the engine before this call). Empty
    /// `group_ids` returns empty without hitting the DB.
    ///
    /// Same WHERE shape + sort + cursor + lifecycle filter as
    /// `stream_direct_user_resources`; the only difference is the
    /// subject filter.
    ///
    /// Default fails loud — same rationale as the other stream
    /// methods.
    async fn stream_direct_user_group_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _group_ids: &[Uuid],
        _app: AppView,
        _action: u32,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_direct_user_group_resources not implemented for \
             this store. Stores participating in the Phase-3 listing engine MUST \
             override this method; opt-out stores must override with an \
             explicit Ok(vec![]). phase3-review A1.".to_string(),
        ))
    }

    /// Phase 3 P3-4 — cover-backed stream for Public shares
    /// (LISTING.md §5 table row 4 / §6). Reads directly from
    /// `public_resources` — the cover row carries
    /// `(resource_id, sort_created)`, no JOIN to the resource
    /// table needed.
    ///
    /// Filters on `resource_type = $T`, `app_ids && ARRAY[$app,
    /// nil_uuid]`, `actions @> ARRAY[$action]`,
    /// `(sort_created, resource_id) < $cursor`. Uses
    /// `public_resources_by_created (resource_type, sort_created
    /// DESC, resource_id DESC)` — pure indexed scan.
    ///
    /// Stores that don't support Public sharing override with
    /// Ok(vec![]). Default fails loud per phase3-review A1.
    async fn stream_public_cover_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _app: AppView,
        _action: u32,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_public_cover_resources not implemented for this \
             store. Override with Ok(vec![]) if Public sharing is unsupported. \
             phase3-review A1.".to_string(),
        ))
    }

    /// Phase 3 P3-4 — cover-backed stream for ServerMember
    /// shares (LISTING.md §5 table row 5 / §6). Same shape as
    /// `stream_public_cover_resources`; reads from
    /// `server_member_resources`. The engine MUST only include
    /// this stream when the caller is authenticated (anonymous
    /// callers are not ServerMembers).
    async fn stream_server_member_cover_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _app: AppView,
        _action: u32,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_server_member_cover_resources not implemented \
             for this store. Override with Ok(vec![]) if ServerMember sharing \
             is unsupported. phase3-review A1.".to_string(),
        ))
    }

    /// Phase 3 P3-5 — per-candidate Deny lookup for the listing
    /// engine (LISTING.md §5.3). Given a (subject, app, action,
    /// resource_type, resource_id) tuple, returns true iff an
    /// access_policies row exists that:
    ///
    ///   * matches the subject (User+id / UserGroup+any of caller's
    ///     groups / ServerMember / Public)
    ///   * has `effect = Deny`
    ///   * has `actions @> ARRAY[$action]`
    ///   * has `context_app_ids && ARRAY[$app, nil_uuid]`
    ///   * passes the lifecycle filter
    ///     (`NOT revoked AND (expires_at IS NULL OR expires_at > now())`)
    ///
    /// Single indexed lookup against `ap_lookup_idx
    /// (resource_type, resource_id, subject_type, subject_id)
    /// WHERE NOT revoked` (migration 00009). Typical case 0 rows —
    /// most resources have no Deny.
    ///
    /// Default returns Ok(false) — stores that participate in the
    /// listing engine but don't yet implement Deny-checking will
    /// silently surface every Allow. That's the historic Phase-1
    /// shape, so this default is the "safe migration default", not
    /// a fail-loud guard like the stream methods.
    async fn is_denied(
        &self,
        _auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        _app: AppView,
        _action: u32,
        _resource_id: Uuid,
    ) -> Result<bool, AuthError> {
        Ok(false)
    }

    /// Phase 3 P3-4 — cover-backed stream for one large user-group
    /// (LISTING.md §6.2). Reads from
    /// `user_group_accessible_resources` filtered by
    /// `user_group_id = $group`. The engine ONLY uses this stream
    /// for groups whose `materialize_uga` flag is true (the daily
    /// recompute job per P5-3 maintains the flag); small groups
    /// take the live-join `stream_direct_user_group_resources`
    /// path. The Phase-3 P3-8 planner makes that choice; this
    /// method ships now so the surface is complete.
    async fn stream_large_user_group_cover_resources(
        &self,
        _auth_info: &ResourceAuthInfo,
        _user_group_id: &Uuid,
        _app: AppView,
        _action: u32,
        _cursor: Option<crate::list::ListingCursor>,
        _batch_size: usize,
    ) -> Result<Vec<crate::list::StreamItem>, AuthError> {
        Err(AuthError::Evaluation(
            "PolicyStore::stream_large_user_group_cover_resources not \
             implemented for this store. Override with Ok(vec![]) if cover \
             tables aren't used. phase3-review A1.".to_string(),
        ))
    }
}

#[cfg(test)]
mod store_tests {
    use super::*;

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

    /// In-memory mock that satisfies the trait — useful as a smoke
    /// test that the trait shape compiles and is implementable.
    #[derive(Debug)]
    struct EmptyStore;

    #[async_trait]
    impl PolicyStore for EmptyStore {
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
    }

    #[tokio::test]
    async fn empty_store_returns_empty() {
        let store = EmptyStore;
        let info = auth_info_for_files();
        let subject = Subject::Anonymous;
        let app = AppView {
            id: Uuid::nil(),
            trusted: false,
        };
        assert!(store.fetch_owners(&info, &[]).await.unwrap().is_empty());
        assert!(store
            .fetch_direct_policies(&info, &subject, app, 0, &[])
            .await
            .unwrap()
            .is_empty());
        assert!(store
            .fetch_resource_group_memberships(&info, &[])
            .await
            .unwrap()
            .is_empty());
        assert!(store
            .fetch_resource_group_policies(&info, &subject, app, 0, &[])
            .await
            .unwrap()
            .is_empty());
        assert!(store
            .fetch_type_level_policies(&info, &subject, app, 0)
            .await
            .unwrap()
            .is_empty());
    }

    #[test]
    fn app_view_partial_eq() {
        let a = AppView { id: Uuid::nil(), trusted: false };
        let b = AppView { id: Uuid::nil(), trusted: false };
        assert_eq!(a, b);
    }
}
