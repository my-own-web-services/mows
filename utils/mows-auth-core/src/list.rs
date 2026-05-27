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

// ---------------------------------------------------------------------------
// Phase 3 — k-way merge listing engine (LISTING.md §3 + §5 + §8)
// ---------------------------------------------------------------------------
//
// The Phase-1 fold above answers "what's allowed?" by materialising every
// (resource_id, effect) pair across every source. That's fine at the
// scale the spec calls "owner-dominated" and below; above ~100k allowed
// resources per call it doesn't fit memory.
//
// Phase 3 replaces it (for the auth-mediated path; the §4 OwnerOnly fast
// path bypasses both) with a sorted stream merge keyed on a
// (sort_key, resource_id) tuple. Each access source is a SortedStream
// yielding items in DESC order; a BinaryHeap merges them and a HashSet
// dedups by resource_id. Pages are bounded by `page_size`; no source ever
// materialises more than ~page_size + dedup-buffer rows per call
// (LISTING.md §5.1).
//
// This commit ships the trait + the merge function + tests over an in-
// memory stream impl. The cover-table-backed and store-backed stream
// impls land in follow-up commits (P3-2…P3-5); filez stays on the
// Phase-1 fold via `list_visible_resource_ids` for now.

use std::cmp::Ordering;
use std::collections::BinaryHeap;

use async_trait::async_trait;

/// One item yielded by a [`SortedStream`]. The merge orders these by
/// `(sort_key DESC, resource_id DESC)` — same tie-break the cover-table
/// indexes use (`public_resources_by_created (resource_type,
/// sort_created DESC, resource_id DESC)`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StreamItem {
    pub sort_key: chrono::NaiveDateTime,
    pub resource_id: Uuid,
}

/// Keyset pagination cursor (LISTING.md §5.4). A page returns the
/// cursor for the next page; callers thread it back through unchanged.
/// `None` on the response means "this was the last page".
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ListingCursor {
    pub sort_key: chrono::NaiveDateTime,
    pub resource_id: Uuid,
}

/// Source tag — identifies which stream produced an item. Used for the
/// audit trail and for the Deny-skip optimisation per LISTING.md §5.3
/// ("Skip the Deny check when the source is owned_by_me or
/// direct_user/effect=Allow AND the candidate is the user's own
/// resource — ownership is never Denied").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamSource {
    Owned,
    DirectUser,
    DirectUserGroup,
    ViaResourceGroup,
    PublicMaterialized,
    ServerMemberMaterialized,
    OwnedByOwner,
    AccessibleByOwner,
}

/// One sorted source of `(sort_key, resource_id)` items, yielded in
/// `(sort_key DESC, resource_id DESC)` order. Implementations are
/// typically backed by an indexed postgres query with internal cursor
/// state (LISTING.md §5 stream table); the trait stays generic over
/// "anything that yields items in the canonical order".
///
/// `next` is async because each stream's underlying query may need to
/// fetch additional batches from the store as the merge advances.
#[async_trait]
pub trait SortedStream: Send {
    /// Source tag for audit + Deny-skip decisions.
    fn source(&self) -> StreamSource;

    /// Yield the next item, or `None` when the stream is exhausted.
    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError>;
}

/// One page of merged results from [`merge_streams`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListingPage {
    pub resource_ids: Vec<Uuid>,
    /// Cursor for the next page. `None` if the merge exhausted every
    /// stream before reaching `page_size` items.
    pub next_cursor: Option<ListingCursor>,
}

/// Internal heap entry — pairs a stream's head item with the index of
/// the stream that produced it, so when we pop the top entry we know
/// which stream to advance.
#[derive(Debug, Clone, Copy)]
struct HeapEntry {
    item: StreamItem,
    stream_idx: usize,
}

impl PartialEq for HeapEntry {
    fn eq(&self, other: &Self) -> bool {
        self.item == other.item
    }
}
impl Eq for HeapEntry {}

impl Ord for HeapEntry {
    /// Max-heap on `(sort_key, resource_id)`. BinaryHeap pops the
    /// largest element first, which is the most-recent item across
    /// every stream — the DESC order LISTING.md §5 calls for.
    fn cmp(&self, other: &Self) -> Ordering {
        self.item
            .sort_key
            .cmp(&other.item.sort_key)
            .then_with(|| self.item.resource_id.cmp(&other.item.resource_id))
    }
}
impl PartialOrd for HeapEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// K-way merge of sorted streams with keyset pagination + per-resource
/// dedup. The engine's Phase-3 listing primitive.
///
/// **Cursor semantics**: `cursor` is the LAST item of the previous
/// page. The merge skips items with
/// `(sort_key, resource_id) >= (cursor.sort_key, cursor.resource_id)`
/// (in the DESC ordering: anything newer than or equal to the cursor
/// was already on the previous page). On the FIRST page, pass `None`.
///
/// **Deny check**: per LISTING.md §5.3 the engine must filter each
/// candidate against access_policies for an Deny matching the subject
/// before yielding. The hook is deliberately NOT in this function yet
/// — wiring it requires a `PolicyStore` reference and a Deny query
/// the store doesn't expose today. P3-3 adds the hook + the
/// optimisation that skips it for owner-sourced candidates.
///
/// **Dedup**: a single resource may appear via multiple streams (e.g.
/// shared directly AND via a resource-group AND Public). The first
/// stream wins; subsequent occurrences are silently skipped. The
/// dedup set is bounded by `page_size + small_dedup_buffer` per
/// LISTING.md §5.1.
pub async fn merge_streams(
    streams: &mut [Box<dyn SortedStream>],
    cursor: Option<ListingCursor>,
    page_size: usize,
) -> Result<ListingPage, AuthError> {
    use std::collections::HashSet;

    let mut heap: BinaryHeap<HeapEntry> = BinaryHeap::with_capacity(streams.len());

    // Prime the heap: pull the first item from each stream.
    for (idx, stream) in streams.iter_mut().enumerate() {
        if let Some(item) = stream.next().await? {
            heap.push(HeapEntry {
                item,
                stream_idx: idx,
            });
        }
    }

    let mut yielded: Vec<Uuid> = Vec::with_capacity(page_size);
    let mut seen: HashSet<Uuid> = HashSet::with_capacity(page_size);
    let mut last_item: Option<StreamItem> = None;

    while yielded.len() < page_size {
        let Some(top) = heap.pop() else {
            break;
        };

        // Advance the producing stream; push its next item back.
        if let Some(next) = streams[top.stream_idx].next().await? {
            heap.push(HeapEntry {
                item: next,
                stream_idx: top.stream_idx,
            });
        }

        // Cursor gate: skip items that are not strictly past the
        // previous page's tail. Compare via the same (sort_key,
        // resource_id) tuple ordering the heap uses.
        if let Some(c) = cursor {
            let cmp = top
                .item
                .sort_key
                .cmp(&c.sort_key)
                .then_with(|| top.item.resource_id.cmp(&c.resource_id));
            // DESC stream → previous page tail had the smallest
            // (sort_key, resource_id) yielded so far. Anything >= the
            // cursor was on a previous page.
            if cmp != Ordering::Less {
                continue;
            }
        }

        // Dedup. First stream to yield this id wins.
        if !seen.insert(top.item.resource_id) {
            continue;
        }

        yielded.push(top.item.resource_id);
        last_item = Some(top.item);
    }

    let next_cursor = if yielded.len() == page_size {
        // Returned a full page → there may be more. Carry the tail.
        last_item.map(|it| ListingCursor {
            sort_key: it.sort_key,
            resource_id: it.resource_id,
        })
    } else {
        // Exhausted every stream before filling the page → no more.
        None
    };

    Ok(ListingPage {
        resource_ids: yielded,
        next_cursor,
    })
}

#[cfg(test)]
mod merge_tests {
    //! Validate the k-way merge over an in-memory stream impl. The
    //! cover-table-backed and store-backed stream impls (P3-2…) land
    //! in follow-up commits; these tests pin the ordering, dedup,
    //! pagination, and exhaustion contracts.

    use super::*;
    use std::collections::VecDeque;

    /// In-memory stream backed by a pre-sorted VecDeque. Test-only.
    struct VecStream {
        source: StreamSource,
        items: VecDeque<StreamItem>,
    }

    #[async_trait]
    impl SortedStream for VecStream {
        fn source(&self) -> StreamSource {
            self.source
        }
        async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
            Ok(self.items.pop_front())
        }
    }

    fn ts(epoch_seconds: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(epoch_seconds, 0)
            .expect("valid epoch")
            .naive_utc()
    }

    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn stream(source: StreamSource, items: Vec<(i64, u128)>) -> Box<dyn SortedStream> {
        Box::new(VecStream {
            source,
            items: items
                .into_iter()
                .map(|(t, id)| StreamItem {
                    sort_key: ts(t),
                    resource_id: uuid(id),
                })
                .collect(),
        })
    }

    #[tokio::test]
    async fn empty_streams_return_empty_page() {
        let mut streams: Vec<Box<dyn SortedStream>> = vec![];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert!(page.resource_ids.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[tokio::test]
    async fn single_stream_passes_through_in_desc_order() {
        // Stream produces items already in DESC order; merge must
        // preserve it.
        let mut streams = vec![stream(
            StreamSource::Owned,
            vec![(100, 3), (90, 2), (80, 1)],
        )];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert_eq!(page.resource_ids, vec![uuid(3), uuid(2), uuid(1)]);
        assert_eq!(page.next_cursor, None);
    }

    #[tokio::test]
    async fn interleaves_two_streams_by_sort_key() {
        let mut streams = vec![
            stream(StreamSource::Owned, vec![(100, 1), (80, 3)]),
            stream(StreamSource::PublicMaterialized, vec![(90, 2), (70, 4)]),
        ];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(1), uuid(2), uuid(3), uuid(4)],
            "expected DESC interleave"
        );
    }

    #[tokio::test]
    async fn tie_breaks_by_resource_id_desc() {
        // Two items with identical sort_key; resource_id breaks the
        // tie DESC (matches the cover-table indexes).
        let mut streams = vec![
            stream(StreamSource::Owned, vec![(100, 1)]),
            stream(StreamSource::PublicMaterialized, vec![(100, 5)]),
        ];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert_eq!(page.resource_ids, vec![uuid(5), uuid(1)]);
    }

    #[tokio::test]
    async fn dedups_by_resource_id_across_streams() {
        // Same resource_id from two streams; first occurrence wins.
        let mut streams = vec![
            stream(StreamSource::Owned, vec![(100, 1), (80, 2)]),
            stream(
                StreamSource::PublicMaterialized,
                vec![(90, 1), (70, 3)],
            ),
        ];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(1), uuid(2), uuid(3)],
            "resource 1 must appear once even though two streams emit it"
        );
    }

    #[tokio::test]
    async fn pagination_stops_at_page_size_and_returns_cursor() {
        let mut streams = vec![stream(
            StreamSource::Owned,
            vec![(100, 1), (90, 2), (80, 3), (70, 4), (60, 5)],
        )];
        let page = merge_streams(&mut streams, None, 3).await.unwrap();
        assert_eq!(page.resource_ids, vec![uuid(1), uuid(2), uuid(3)]);
        assert_eq!(
            page.next_cursor,
            Some(ListingCursor {
                sort_key: ts(80),
                resource_id: uuid(3),
            })
        );
    }

    #[tokio::test]
    async fn cursor_skips_items_already_on_previous_page() {
        let mut streams = vec![stream(
            StreamSource::Owned,
            vec![(100, 1), (90, 2), (80, 3), (70, 4), (60, 5)],
        )];
        // Previous page ended at (80, 3); next page should start at 4.
        let cursor = ListingCursor {
            sort_key: ts(80),
            resource_id: uuid(3),
        };
        let page = merge_streams(&mut streams, Some(cursor), 10)
            .await
            .unwrap();
        assert_eq!(page.resource_ids, vec![uuid(4), uuid(5)]);
        assert_eq!(page.next_cursor, None, "exhausted → no more pages");
    }

    #[tokio::test]
    async fn no_next_cursor_when_page_underflows() {
        // Streams together yield 2 items; page_size = 10.
        let mut streams = vec![stream(
            StreamSource::Owned,
            vec![(100, 1), (90, 2)],
        )];
        let page = merge_streams(&mut streams, None, 10).await.unwrap();
        assert_eq!(page.resource_ids.len(), 2);
        assert_eq!(page.next_cursor, None);
    }

    #[tokio::test]
    async fn merges_seven_streams_correctly() {
        // Worst-case width: every LISTING.md §5 source kind active.
        let mut streams = vec![
            stream(StreamSource::Owned, vec![(100, 10)]),
            stream(StreamSource::DirectUser, vec![(99, 20)]),
            stream(StreamSource::DirectUserGroup, vec![(98, 30)]),
            stream(StreamSource::ViaResourceGroup, vec![(97, 40)]),
            stream(StreamSource::PublicMaterialized, vec![(96, 50)]),
            stream(StreamSource::ServerMemberMaterialized, vec![(95, 60)]),
            stream(StreamSource::OwnedByOwner, vec![(94, 70)]),
        ];
        let page = merge_streams(&mut streams, None, 100).await.unwrap();
        assert_eq!(
            page.resource_ids,
            vec![
                uuid(10),
                uuid(20),
                uuid(30),
                uuid(40),
                uuid(50),
                uuid(60),
                uuid(70),
            ]
        );
    }
}
