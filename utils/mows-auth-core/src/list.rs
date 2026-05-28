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
/// Per-candidate Deny check hook for the listing engine
/// (LISTING.md §5.3). The merge calls
/// `is_denied(item, source)` for every candidate it pops; items
/// where the checker returns true are silently skipped. Items
/// where the checker errors propagate.
///
/// Caller-supplied so the engine doesn't have to know about
/// PolicyStore or the caller's auth context. The concrete
/// [`PolicyStoreDenyChecker`] wires the most common case (filez
/// using its own PolicyStore impl); other deployments can write
/// their own.
#[async_trait]
pub trait DenyChecker: Send + Sync {
    /// Returns true iff the engine MUST skip this item because of
    /// an overriding Deny. `source` enables the
    /// "ownership is never Denied" optimisation
    /// (LISTING.md §5.3) — owner-sourced candidates skip the
    /// roundtrip.
    async fn is_denied(
        &self,
        item: &StreamItem,
        source: StreamSource,
    ) -> Result<bool, AuthError>;
}

/// PolicyStore-backed [`DenyChecker`]. Holds the subject + app +
/// action + auth_info so the merge only carries the trait object
/// — no per-item parameter assembly.
///
/// Honors the `owner_source_skip` optimisation: items from
/// [`StreamSource::Owned`] skip the Deny query entirely.
/// POLICY_SEMANTICS.md §3 step 4: a Deny against the resource
/// owner never applies (ownership is unilateral). Saves a round
/// trip on the owner-dominated path that the Phase-3 design
/// already optimises via OwnerOnly fast path; the optimisation
/// here covers the combined "owned + shared" tab where Owned
/// participates in the merge.
pub struct PolicyStoreDenyChecker<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    subject: &'a Subject,
    app: AppView,
    action: u32,
}

impl<'a, S: PolicyStore + ?Sized> PolicyStoreDenyChecker<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        subject: &'a Subject,
        app: AppView,
        action: u32,
    ) -> Self {
        Self {
            store,
            auth_info,
            subject,
            app,
            action,
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> DenyChecker for PolicyStoreDenyChecker<'a, S> {
    async fn is_denied(
        &self,
        item: &StreamItem,
        source: StreamSource,
    ) -> Result<bool, AuthError> {
        // Owner-source skip: ownership is never Denied
        // (POLICY_SEMANTICS.md §3 step 4 / LISTING.md §5.3).
        if matches!(source, StreamSource::Owned) {
            return Ok(false);
        }
        self.store
            .is_denied(
                self.auth_info,
                self.subject,
                self.app,
                self.action,
                item.resource_id,
            )
            .await
    }
}

pub async fn merge_streams<'a>(
    streams: &mut [Box<dyn SortedStream + 'a>],
    cursor: Option<ListingCursor>,
    page_size: usize,
) -> Result<ListingPage, AuthError> {
    merge_streams_with_deny_check(streams, cursor, page_size, None).await
}

/// Same as [`merge_streams`] but accepts a [`DenyChecker`]. Each
/// candidate yielded by the merge is filtered through
/// `deny_checker.is_denied(item, source)`; items that come back
/// `Ok(true)` are silently skipped (the cursor still advances past
/// them so the next page picks up after).
///
/// `merge_streams` itself delegates here with `deny_check = None`
/// for the test path that doesn't need Deny filtering. Production
/// callers should always pass `Some(checker)` so Deny precedence
/// is enforced (LISTING.md §5.3 + POLICY_SEMANTICS.md §3 step 5).
pub async fn merge_streams_with_deny_check<'a>(
    streams: &mut [Box<dyn SortedStream + 'a>],
    cursor: Option<ListingCursor>,
    page_size: usize,
    deny_checker: Option<&dyn DenyChecker>,
) -> Result<ListingPage, AuthError> {
    use std::collections::HashSet;

    // page_size = 0 is degenerate (would yield zero items + an empty
    // heap iteration). Caller bug — return empty page with no cursor
    // rather than spinning. Matches the
    // pagination_with_zero_page_size test (phase3-review A11).
    if page_size == 0 {
        return Ok(ListingPage {
            resource_ids: Vec::new(),
            next_cursor: None,
        });
    }

    let mut heap: BinaryHeap<HeapEntry> = BinaryHeap::with_capacity(streams.len());

    // Tracks each stream's last yielded item — used to debug-assert
    // the DESC contract every stream MUST honour (phase3-review A2 /
    // TECH-2 / SLOP-3). Release builds skip the check, trusting the
    // store-side query's ORDER BY clause.
    #[cfg(debug_assertions)]
    let mut last_yielded_per_stream: Vec<Option<StreamItem>> =
        vec![None; streams.len()];

    // Prime the heap: pull the first item from each stream.
    for (idx, stream) in streams.iter_mut().enumerate() {
        if let Some(item) = stream.next().await? {
            #[cfg(debug_assertions)]
            {
                last_yielded_per_stream[idx] = Some(item);
            }
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
            #[cfg(debug_assertions)]
            {
                // DESC contract: each new item from a stream MUST be
                // strictly less than (sort_key, resource_id) of its
                // previous item — same ordering the heap uses. A
                // store that mis-orders silently produces wrong merge
                // output in release builds; this assert catches it
                // in tests + dev.
                if let Some(prev) = last_yielded_per_stream[top.stream_idx] {
                    let cmp = next
                        .sort_key
                        .cmp(&prev.sort_key)
                        .then_with(|| next.resource_id.cmp(&prev.resource_id));
                    debug_assert_eq!(
                        cmp,
                        Ordering::Less,
                        "SortedStream contract violated: stream {} yielded {:?} after {:?} \
                         (must be strictly DESC on (sort_key, resource_id))",
                        top.stream_idx,
                        next,
                        prev,
                    );
                }
                last_yielded_per_stream[top.stream_idx] = Some(next);
            }
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

        // Deny check per LISTING.md §5.3. The checker honors the
        // "ownership is never Denied" optimisation when the source
        // is Owned (PolicyStoreDenyChecker handles this). Items
        // where is_denied returns true are silently skipped — the
        // cursor still advances past them so the next page picks
        // up where we left off.
        if let Some(checker) = deny_checker {
            // `streams[top.stream_idx].source()` is a constant —
            // unaffected by the advance call earlier in the loop.
            let source = streams[top.stream_idx].source();
            if checker.is_denied(&top.item, source).await? {
                continue;
            }
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

/// PolicyStore-backed Owned stream for the k-way merge. Lazy: pulls
/// at most one batch per refill, refills only when the local buffer
/// drains. At most `batch_size + 1` round trips for a full page in
/// the worst case — typically one round trip per stream per page
/// (LISTING.md §5.1).
///
/// `OwnedStream::source()` is [`StreamSource::Owned`]. The Phase-3
/// merge uses this tag for the Deny-skip optimisation (P3-3) —
/// owner-sourced candidates skip the Deny check because ownership
/// is never Denied (POLICY_SEMANTICS.md §3).
pub struct OwnedStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    user_id: Uuid,
    /// Local FIFO buffer of items pulled from the store. The
    /// `merge_streams` heap pulls one item at a time via `next`;
    /// the buffer amortises round trips.
    buffer: std::collections::VecDeque<StreamItem>,
    /// Cursor for the NEXT batch — the last item of the previous
    /// batch. `None` before the first batch.
    cursor: Option<ListingCursor>,
    batch_size: usize,
    /// Set once the store returned fewer than `batch_size` items —
    /// no more batches to pull.
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> OwnedStream<'a, S> {
    /// Construct the stream with an initial cursor (typically
    /// `None` on the first page, or the cursor from the previous
    /// page when the caller resumes).
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        user_id: Uuid,
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            user_id,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            exhausted: false,
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for OwnedStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::Owned
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_owned_resources(
                    self.auth_info,
                    &self.user_id,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            // Update the cursor to the LAST item of this batch so the
            // next refill picks up strictly past it. If the batch was
            // empty there's nothing to update; `exhausted` handles
            // the stop.
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

/// PolicyStore-backed stream for resources shared with a single
/// user via `subject_type=User, subject_id=$user_id` policies
/// (LISTING.md §5 table row 1, `direct_user`).
///
/// Same lazy-refill shape as [`OwnedStream`]; the difference is
/// which store method backs the batch fetch
/// (`PolicyStore::stream_direct_user_resources`) and which
/// `StreamSource` tag the merge sees ([`StreamSource::DirectUser`]).
pub struct DirectUserStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    user_id: Uuid,
    app: AppView,
    action: u32,
    buffer: std::collections::VecDeque<StreamItem>,
    cursor: Option<ListingCursor>,
    batch_size: usize,
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> DirectUserStream<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        user_id: Uuid,
        app: AppView,
        action: u32,
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            user_id,
            app,
            action,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            exhausted: false,
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for DirectUserStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::DirectUser
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_direct_user_resources(
                    self.auth_info,
                    &self.user_id,
                    self.app,
                    self.action,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

/// PolicyStore-backed stream for resources shared with ANY of the
/// caller's user-groups (LISTING.md §5 table row 2,
/// `direct_user_group_k`). The caller passes the closed set of
/// `group_ids` once; the stream issues a single
/// `subject_id IN ($group_ids)` query per batch.
///
/// Empty `group_ids` short-circuits to an exhausted stream without
/// touching the DB — the engine still pushes this stream into the
/// heap so the merge sees a consistent shape across all subjects.
pub struct DirectUserGroupStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    group_ids: &'a [Uuid],
    app: AppView,
    action: u32,
    buffer: std::collections::VecDeque<StreamItem>,
    cursor: Option<ListingCursor>,
    batch_size: usize,
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> DirectUserGroupStream<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        group_ids: &'a [Uuid],
        app: AppView,
        action: u32,
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            group_ids,
            app,
            action,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            // Caller passed no groups → there are no shares to find.
            // Set exhausted up front; subsequent next() calls return None
            // without a store round trip.
            exhausted: group_ids.is_empty(),
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for DirectUserGroupStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::DirectUserGroup
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_direct_user_group_resources(
                    self.auth_info,
                    self.group_ids,
                    self.app,
                    self.action,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

/// LISTING.md §4 + §3 high-level entry point: takes a subject +
/// app + action + cursor + page_size, picks the right combination
/// of streams, runs the merge, returns a [`ListingPage`].
///
/// Two paths today:
///
///   * **OwnerOnly fast path** (LISTING.md §4): no merge, no
///     Deny check, no policy lookups — direct indexed scan of
///     resources where `owner_id = $caller`. Engages when the
///     caller is the resource owner and the app is `trusted`
///     (POLICY_SEMANTICS.md §2.2). Phase-3 entry point: just
///     [`OwnedStream`] yielding from
///     [`PolicyStore::stream_owned_resources`].
///
///   * **AuthMediated merge** (LISTING.md §3 + §5): the k-way
///     stream merge over every applicable source. Picks streams
///     based on the subject's authentication state and group
///     memberships; runs through
///     [`merge_streams_with_deny_check`] with a
///     [`PolicyStoreDenyChecker`].
///
/// The planner does NOT consult `materialize_uga` flags to pick
/// `LargeUserGroupCoverStream` vs `DirectUserGroupStream` per
/// group yet — that decision lands when the engine grows a way
/// to fetch the flag (today the flag is filez-side state). For
/// now the planner uses `DirectUserGroupStream` for all of the
/// caller's groups; the cover-backed alternative is a future
/// optimisation.
///
/// `accessible_resource_group_ids` is pre-computed (Once per
/// call via [`PolicyStore::fetch_accessible_resource_group_ids`])
/// to avoid the planner needing to issue that query itself.
pub async fn list_visible_paginated<S: PolicyStore + ?Sized>(
    store: &S,
    auth_info: &ResourceAuthInfo,
    subject: &Subject,
    app: AppView,
    action: u32,
    cursor: Option<ListingCursor>,
    page_size: usize,
    batch_size: usize,
) -> Result<ListingPage, AuthError> {
    // OwnerOnly fast path: trusted-app + authenticated caller =>
    // direct scan of owned resources. No Deny check (owner-grant
    // is unilateral per POLICY_SEMANTICS.md §3 step 4); no policy
    // lookups; no merge.
    if app.trusted {
        if let Some(user_id) = subject.user_id() {
            let mut stream = OwnedStream::new(
                store,
                auth_info,
                user_id,
                cursor,
                batch_size.max(page_size),
            );
            let mut streams: Vec<Box<dyn SortedStream + '_>> =
                vec![Box::new(boxable_stream_ref(&mut stream))];
            return merge_streams(&mut streams, cursor, page_size).await;
        }
    }

    // AuthMediated path: build the full stream set + Deny checker
    // + run the k-way merge. The stream set depends on subject
    // shape (anonymous vs user) and the caller's group memberships.
    let resource_group_ids = store
        .fetch_accessible_resource_group_ids(auth_info, subject, app, action)
        .await?;

    // Each Box<dyn SortedStream + '_> in the vec borrows
    // {store, auth_info, subject, app}; explicit lifetime works
    // because they all share the function-level 'caller lifetime.
    let user_groups: Vec<Uuid> = match subject {
        Subject::User { groups, .. } => groups.clone(),
        Subject::Anonymous => Vec::new(),
    };

    // User-specific streams: only built when the caller is
    // authenticated. Anonymous callers participate only in the
    // Public + group + resource-group + AccessibleByOwner paths.
    let mut owned_stream: Option<OwnedStream<'_, S>> = subject.user_id().map(|uid| {
        OwnedStream::new(store, auth_info, uid, cursor, batch_size)
    });
    let mut direct_user_stream: Option<DirectUserStream<'_, S>> =
        subject.user_id().map(|uid| {
            DirectUserStream::new(
                store, auth_info, uid, app, action, cursor, batch_size,
            )
        });
    let mut sm_cover: Option<ServerMemberCoverStream<'_, S>> = subject.user_id().map(|_| {
        ServerMemberCoverStream::new(store, auth_info, app, action, cursor, batch_size)
    });

    // Subject-independent streams: built unconditionally. Empty
    // group_ids → DirectUserGroupStream short-circuits; empty
    // resource_group_ids → ViaResourceGroupStream short-circuits.
    let mut direct_group_stream = DirectUserGroupStream::new(
        store, auth_info, &user_groups, app, action, cursor, batch_size,
    );
    let mut via_rg_stream = ViaResourceGroupStream::new(
        store, auth_info, &resource_group_ids, cursor, batch_size,
    );
    let mut public_cover = PublicCoverStream::new(
        store, auth_info, app, action, cursor, batch_size,
    );
    let mut abo_stream = AccessibleByOwnerStream::new(
        store, auth_info, subject, app, action, cursor, batch_size,
    );

    // ## Stream order — load-bearing invariant
    //
    // The merge dedups by `resource_id`. When the same resource
    // appears in MULTIPLE streams at the same `(sort_key,
    // resource_id)` tuple, the FIRST stream in this vec wins the
    // emit. Reordering this list silently changes which audit-tag
    // surfaces for a multi-source resource (Phase 7 admin UI will
    // surface `StreamSource`).
    //
    // Order rationale, strongest grant first:
    //   1. Owned                      — direct ownership; never Denied.
    //   2. DirectUser                 — user-specific Allow.
    //   3. DirectUserGroup            — group-specific Allow.
    //   4. ViaResourceGroup           — indirect via shared resource-group.
    //   5. PublicCover                — broad share.
    //   6. ServerMemberCover          — broad share (logged-in only).
    //   7. AccessibleByOwner          — recursive (stub today).
    //
    // phase3-final-review A6 / SLOP-5.
    let mut streams: Vec<Box<dyn SortedStream + '_>> = Vec::new();
    if let Some(s) = owned_stream.as_mut() {
        streams.push(Box::new(boxable_stream_ref(s)));
    }
    if let Some(s) = direct_user_stream.as_mut() {
        streams.push(Box::new(boxable_stream_ref(s)));
    }
    streams.push(Box::new(boxable_stream_ref(&mut direct_group_stream)));
    streams.push(Box::new(boxable_stream_ref(&mut via_rg_stream)));
    streams.push(Box::new(boxable_stream_ref(&mut public_cover)));
    if let Some(s) = sm_cover.as_mut() {
        streams.push(Box::new(boxable_stream_ref(s)));
    }
    streams.push(Box::new(boxable_stream_ref(&mut abo_stream)));

    let checker = PolicyStoreDenyChecker::new(store, auth_info, subject, app, action);
    merge_streams_with_deny_check(&mut streams, cursor, page_size, Some(&checker)).await
}

/// Wrap a `&mut dyn SortedStream` as a fresh `Box<dyn SortedStream>`
/// without taking ownership. Used by the planner to assemble the
/// stream vec from locally-owned stream instances.
fn boxable_stream_ref<'a, T: SortedStream + 'a>(
    s: &'a mut T,
) -> impl SortedStream + 'a {
    struct StreamRef<'a, T: SortedStream + ?Sized>(&'a mut T);
    #[async_trait]
    impl<'a, T: SortedStream + ?Sized + 'a> SortedStream for StreamRef<'a, T> {
        fn source(&self) -> StreamSource {
            self.0.source()
        }
        async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
            self.0.next().await
        }
    }
    StreamRef(s)
}

/// PolicyStore-backed stream for resources shared with the caller
/// via their containing resource-group (LISTING.md §5 row 3 /
/// §5.2 `via_resource_group`). Caller pre-computes the closed set
/// of accessible resource-group ids (typically via
/// [`PolicyStore::fetch_accessible_resource_group_ids`]); the
/// stream then walks the resource table JOIN membership table for
/// those groups in `(created_time, id) DESC` order.
///
/// Empty `resource_group_ids` short-circuits to an exhausted
/// stream — same shape as `DirectUserGroupStream` for empty
/// user-groups.
pub struct ViaResourceGroupStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    resource_group_ids: &'a [Uuid],
    buffer: std::collections::VecDeque<StreamItem>,
    cursor: Option<ListingCursor>,
    batch_size: usize,
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> ViaResourceGroupStream<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        resource_group_ids: &'a [Uuid],
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            resource_group_ids,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            exhausted: resource_group_ids.is_empty(),
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for ViaResourceGroupStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::ViaResourceGroup
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_via_resource_group_resources(
                    self.auth_info,
                    self.resource_group_ids,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

/// Recursive `AccessibleByOwner` stream (LISTING.md §7 /
/// POLICY_SEMANTICS.md §4 "AccessibleByOwner"). For each
/// active `resource_scope = AccessibleByOwner` policy whose
/// subject matches the caller, the stream walks every resource
/// the *policy's owner* has access to — except recursion is
/// broken at depth 1 (the policy owner's OWN
/// `AccessibleByOwner` policies do NOT chain). The cycle break
/// is the only thing keeping the source from being unbounded.
///
/// Today's shape: returns an empty stream. POLICY_SEMANTICS.md
/// §4 + check.rs both defer the recursive expansion to a future
/// phase, and ship a `tracing::warn!` when an `AccessibleByOwner`
/// policy reaches the engine. The stream lands now so the
/// planner can include it in the merge — when the recursive
/// expansion is wired up, only the body of
/// `stream_accessible_by_owner_resources` changes; planner +
/// merge are untouched.
///
/// The cycle-break invariant the future implementation MUST
/// honor: when expanding an `AccessibleByOwner` policy whose
/// owner is `O`, only `Single` and `OwnedByOwner` scopes count
/// — `O`'s own `AccessibleByOwner` policies are NOT chased,
/// matching the engine's check-side guard. The stream's
/// PolicyStore method is signed for exactly that contract.
pub struct AccessibleByOwnerStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    subject: &'a Subject,
    app: AppView,
    action: u32,
    buffer: std::collections::VecDeque<StreamItem>,
    cursor: Option<ListingCursor>,
    batch_size: usize,
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> AccessibleByOwnerStream<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        subject: &'a Subject,
        app: AppView,
        action: u32,
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            subject,
            app,
            action,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            exhausted: false,
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for AccessibleByOwnerStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::AccessibleByOwner
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_accessible_by_owner_resources(
                    self.auth_info,
                    self.subject,
                    self.app,
                    self.action,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

/// Macro to declare a cover-backed stream wrapper. The three
/// cover sources (Public, ServerMember, LargeUserGroup) all share
/// the same lazy-refill skeleton — only the store method and
/// source tag differ. Defining them via macro removes ~80 lines of
/// near-identical boilerplate.
macro_rules! declare_cover_stream {
    (
        $(#[$attr:meta])*
        $name:ident, $source:expr, $store_method:ident
    ) => {
        $(#[$attr])*
        pub struct $name<'a, S: PolicyStore + ?Sized> {
            store: &'a S,
            auth_info: &'a ResourceAuthInfo,
            app: AppView,
            action: u32,
            buffer: std::collections::VecDeque<StreamItem>,
            cursor: Option<ListingCursor>,
            batch_size: usize,
            exhausted: bool,
        }

        impl<'a, S: PolicyStore + ?Sized> $name<'a, S> {
            pub fn new(
                store: &'a S,
                auth_info: &'a ResourceAuthInfo,
                app: AppView,
                action: u32,
                initial_cursor: Option<ListingCursor>,
                batch_size: usize,
            ) -> Self {
                debug_assert!(batch_size > 0, "batch_size must be > 0");
                Self {
                    store,
                    auth_info,
                    app,
                    action,
                    buffer: std::collections::VecDeque::with_capacity(batch_size),
                    cursor: initial_cursor,
                    batch_size,
                    exhausted: false,
                }
            }
        }

        #[async_trait]
        impl<'a, S: PolicyStore + ?Sized> SortedStream for $name<'a, S> {
            fn source(&self) -> StreamSource {
                $source
            }
            async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
                if self.buffer.is_empty() && !self.exhausted {
                    let batch = self
                        .store
                        .$store_method(
                            self.auth_info,
                            self.app,
                            self.action,
                            self.cursor,
                            self.batch_size,
                        )
                        .await?;
                    if batch.len() < self.batch_size {
                        self.exhausted = true;
                    }
                    if let Some(last) = batch.last() {
                        self.cursor = Some(ListingCursor {
                            sort_key: last.sort_key,
                            resource_id: last.resource_id,
                        });
                    }
                    self.buffer.extend(batch);
                }
                Ok(self.buffer.pop_front())
            }
        }
    };
}

declare_cover_stream!(
    /// LISTING.md §5 row 4 / §6 — Public-shared resources via
    /// `public_resources` cover table. Pure indexed scan; no JOIN
    /// to access_policies. Same lazy refill as [`OwnedStream`].
    PublicCoverStream,
    StreamSource::PublicMaterialized,
    stream_public_cover_resources
);

declare_cover_stream!(
    /// LISTING.md §5 row 5 / §6 — ServerMember-shared resources
    /// via `server_member_resources` cover table. The engine MUST
    /// only construct this stream when the caller is
    /// authenticated (anonymous → not a ServerMember).
    ServerMemberCoverStream,
    StreamSource::ServerMemberMaterialized,
    stream_server_member_cover_resources
);

/// LISTING.md §6.2 — cover-backed stream for ONE large user-group.
/// Doesn't fit the macro's shape because it carries a
/// `user_group_id` and uses a different store method signature.
pub struct LargeUserGroupCoverStream<'a, S: PolicyStore + ?Sized> {
    store: &'a S,
    auth_info: &'a ResourceAuthInfo,
    user_group_id: Uuid,
    app: AppView,
    action: u32,
    buffer: std::collections::VecDeque<StreamItem>,
    cursor: Option<ListingCursor>,
    batch_size: usize,
    exhausted: bool,
}

impl<'a, S: PolicyStore + ?Sized> LargeUserGroupCoverStream<'a, S> {
    pub fn new(
        store: &'a S,
        auth_info: &'a ResourceAuthInfo,
        user_group_id: Uuid,
        app: AppView,
        action: u32,
        initial_cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Self {
        debug_assert!(batch_size > 0, "batch_size must be > 0");
        Self {
            store,
            auth_info,
            user_group_id,
            app,
            action,
            buffer: std::collections::VecDeque::with_capacity(batch_size),
            cursor: initial_cursor,
            batch_size,
            exhausted: false,
        }
    }
}

#[async_trait]
impl<'a, S: PolicyStore + ?Sized> SortedStream for LargeUserGroupCoverStream<'a, S> {
    fn source(&self) -> StreamSource {
        StreamSource::DirectUserGroup
    }

    async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
        if self.buffer.is_empty() && !self.exhausted {
            let batch = self
                .store
                .stream_large_user_group_cover_resources(
                    self.auth_info,
                    &self.user_group_id,
                    self.app,
                    self.action,
                    self.cursor,
                    self.batch_size,
                )
                .await?;
            if batch.len() < self.batch_size {
                self.exhausted = true;
            }
            if let Some(last) = batch.last() {
                self.cursor = Some(ListingCursor {
                    sort_key: last.sort_key,
                    resource_id: last.resource_id,
                });
            }
            self.buffer.extend(batch);
        }
        Ok(self.buffer.pop_front())
    }
}

#[cfg(test)]
mod planner_tests {
    //! Integration-style tests for `list_visible_paginated`. Use a
    //! single mock store that implements every stream method;
    //! verifies the planner constructs the right merge, applies
    //! the Deny checker, honors the OwnerOnly fast path, and
    //! paginates correctly across multiple sources.
    use super::*;
    use crate::registry::ResourceAuthInfo;
    use async_trait::async_trait;

    #[derive(Default, Debug)]
    struct PlannerStore {
        owned: std::collections::HashMap<Uuid, Vec<StreamItem>>,
        direct_user: std::collections::HashMap<Uuid, Vec<StreamItem>>,
        direct_group: std::collections::HashMap<Uuid, Vec<StreamItem>>,
        public: Vec<StreamItem>,
        server_member: Vec<StreamItem>,
        resource_group_ids: std::collections::HashMap<Uuid, Vec<Uuid>>,
        via_rg: std::collections::HashMap<Uuid, Vec<StreamItem>>,
        denied: std::collections::HashSet<Uuid>,
    }

    #[async_trait]
    impl PolicyStore for PlannerStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn stream_owned_resources(
            &self,
            _: &ResourceAuthInfo,
            user_id: &Uuid,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(
                self.owned.get(user_id).cloned().unwrap_or_default().as_slice(),
                cursor,
                batch_size,
            ))
        }
        async fn stream_direct_user_resources(
            &self,
            _: &ResourceAuthInfo,
            user_id: &Uuid,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(
                self.direct_user.get(user_id).cloned().unwrap_or_default().as_slice(),
                cursor,
                batch_size,
            ))
        }
        async fn stream_direct_user_group_resources(
            &self,
            _: &ResourceAuthInfo,
            group_ids: &[Uuid],
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            let mut all: Vec<StreamItem> = group_ids
                .iter()
                .flat_map(|g| {
                    self.direct_group.get(g).cloned().unwrap_or_default()
                })
                .collect();
            all.sort_by(|a, b| {
                b.sort_key
                    .cmp(&a.sort_key)
                    .then_with(|| b.resource_id.cmp(&a.resource_id))
            });
            all.dedup_by_key(|i| i.resource_id);
            Ok(slice_after_cursor(&all, cursor, batch_size))
        }
        async fn stream_public_cover_resources(
            &self,
            _: &ResourceAuthInfo,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(&self.public, cursor, batch_size))
        }
        async fn stream_server_member_cover_resources(
            &self,
            _: &ResourceAuthInfo,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(&self.server_member, cursor, batch_size))
        }
        async fn fetch_accessible_resource_group_ids(
            &self,
            _: &ResourceAuthInfo,
            subject: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<Uuid>, AuthError> {
            Ok(subject
                .user_id()
                .and_then(|uid| self.resource_group_ids.get(&uid).cloned())
                .unwrap_or_default())
        }
        async fn stream_via_resource_group_resources(
            &self,
            _: &ResourceAuthInfo,
            resource_group_ids: &[Uuid],
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            let mut all: Vec<StreamItem> = resource_group_ids
                .iter()
                .flat_map(|g| self.via_rg.get(g).cloned().unwrap_or_default())
                .collect();
            all.sort_by(|a, b| {
                b.sort_key
                    .cmp(&a.sort_key)
                    .then_with(|| b.resource_id.cmp(&a.resource_id))
            });
            all.dedup_by_key(|i| i.resource_id);
            Ok(slice_after_cursor(&all, cursor, batch_size))
        }
        async fn is_denied(
            &self,
            _: &ResourceAuthInfo,
            subject: &Subject,
            _: AppView,
            _: u32,
            resource_id: Uuid,
        ) -> Result<bool, AuthError> {
            // Honor the SuperAdmin escape per
            // POLICY_SEMANTICS.md §2.1 — same shape as filez's
            // real FilezPolicyStore::is_denied. Without this the
            // mock store's behaviour drifts from production.
            if matches!(
                subject,
                Subject::User {
                    is_super_admin: true,
                    ..
                }
            ) {
                return Ok(false);
            }
            Ok(self.denied.contains(&resource_id))
        }
    }

    fn slice_after_cursor(
        items: &[StreamItem],
        cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Vec<StreamItem> {
        let mut sorted: Vec<StreamItem> = items.iter().cloned().collect();
        sorted.sort_by(|a, b| {
            b.sort_key
                .cmp(&a.sort_key)
                .then_with(|| b.resource_id.cmp(&a.resource_id))
        });
        let mut filtered: Vec<StreamItem> = sorted
            .into_iter()
            .filter(|it| match cursor {
                Some(c) => {
                    let cmp = it
                        .sort_key
                        .cmp(&c.sort_key)
                        .then_with(|| it.resource_id.cmp(&c.resource_id));
                    cmp == std::cmp::Ordering::Less
                }
                None => true,
            })
            .collect();
        filtered.truncate(batch_size);
        filtered
    }

    fn ts(s: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(s, 0).unwrap().naive_utc()
    }
    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }
    fn auth_info() -> ResourceAuthInfo {
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
    fn untrusted_app() -> AppView {
        AppView { id: uuid(99), trusted: false }
    }
    fn trusted_app() -> AppView {
        AppView { id: uuid(99), trusted: true }
    }
    fn item(t: i64, id: u128) -> StreamItem {
        StreamItem {
            sort_key: ts(t),
            resource_id: uuid(id),
        }
    }

    #[tokio::test]
    async fn planner_anonymous_only_sees_public_and_via_rg() {
        let store = PlannerStore {
            public: vec![item(100, 1), item(90, 2)],
            server_member: vec![item(80, 999)], // anonymous MUST NOT see
            ..Default::default()
        };
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &Subject::Anonymous,
            untrusted_app(),
            0,
            None,
            50,
            10,
        )
        .await
        .unwrap();
        assert_eq!(page.resource_ids, vec![uuid(1), uuid(2)]);
        assert!(
            !page.resource_ids.contains(&uuid(999)),
            "anonymous must not see ServerMember-cover items"
        );
    }

    #[tokio::test]
    async fn planner_authenticated_merges_all_sources() {
        let alice = uuid(1);
        let g1 = uuid(11);
        let rg1 = uuid(21);
        let store = PlannerStore {
            owned: [(alice, vec![item(100, 10)])].into(),
            direct_user: [(alice, vec![item(95, 20)])].into(),
            direct_group: [(g1, vec![item(90, 30)])].into(),
            public: vec![item(85, 40)],
            server_member: vec![item(80, 50)],
            resource_group_ids: [(alice, vec![rg1])].into(),
            via_rg: [(rg1, vec![item(75, 60)])].into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![g1]);
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            None,
            100,
            10,
        )
        .await
        .unwrap();
        // All six sources should contribute, interleaved DESC.
        assert_eq!(
            page.resource_ids,
            vec![uuid(10), uuid(20), uuid(30), uuid(40), uuid(50), uuid(60)]
        );
    }

    #[tokio::test]
    async fn planner_owner_only_fast_path_under_trusted_app() {
        // Trusted-app + authenticated caller → OwnerOnly fast path.
        // The planner constructs only the OwnedStream; even if
        // other sources have items, they're skipped.
        let alice = uuid(1);
        let store = PlannerStore {
            owned: [(alice, vec![item(100, 10), item(90, 20)])].into(),
            direct_user: [(alice, vec![item(95, 999)])].into(), // not yielded
            public: vec![item(80, 998)], // not yielded
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            trusted_app(), // trusted!
            0,
            None,
            10,
            10,
        )
        .await
        .unwrap();
        assert_eq!(page.resource_ids, vec![uuid(10), uuid(20)]);
        assert!(
            !page.resource_ids.contains(&uuid(999)),
            "OwnerOnly fast path must skip DirectUser source"
        );
        assert!(
            !page.resource_ids.contains(&uuid(998)),
            "OwnerOnly fast path must skip Public source"
        );
    }

    #[tokio::test]
    async fn planner_applies_deny_check() {
        let alice = uuid(1);
        let store = PlannerStore {
            owned: [(alice, vec![item(100, 10), item(90, 20)])].into(),
            public: vec![item(80, 30)],
            // Item 20 is Denied. Owner-source skips Deny per
            // POLICY_SEMANTICS.md §3 step 4 → 20 stays.
            // Item 30 is Public → Deny applies → filtered.
            denied: [uuid(20), uuid(30)].into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            None,
            10,
            10,
        )
        .await
        .unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(10), uuid(20)],
            "owner-source items skip Deny; non-owner Denied items filtered"
        );
    }

    // phase3-final-review A4 / SECURITY-1 / QA-1: SuperAdmin
    // doesn't take a special path through the planner — it goes
    // through the AuthMediated merge with the standard Deny
    // checker. `is_denied` early-returns Ok(false) for
    // SuperAdmin per POLICY_SEMANTICS.md §2.1, so the merge
    // still surfaces every Allow without filtering. Pin that
    // observable behaviour so a future refactor that adds a
    // separate SuperAdmin path doesn't silently change semantics.
    #[tokio::test]
    async fn planner_super_admin_goes_through_auth_mediated_path_no_deny_filter() {
        let admin = uuid(1);
        let store = PlannerStore {
            owned: [(admin, vec![item(100, 10)])].into(),
            direct_user: [(admin, vec![item(95, 20)])].into(),
            public: vec![item(80, 30)],
            // Mark item 30 as Denied — SuperAdmin must see it
            // anyway because is_denied returns Ok(false).
            denied: [uuid(30)].into(),
            ..Default::default()
        };
        let subject = Subject::User {
            user_id: admin,
            groups: vec![],
            is_super_admin: true,
        };
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            None,
            10,
            10,
        )
        .await
        .unwrap();
        assert!(
            page.resource_ids.contains(&uuid(30)),
            "SuperAdmin must see the Denied item; is_denied early-returns Ok(false)"
        );
        // Sanity-check: all three sources surfaced.
        assert!(page.resource_ids.contains(&uuid(10)));
        assert!(page.resource_ids.contains(&uuid(20)));
    }

    // phase3-final-review A5 / SLOP-8: ViaResourceGroup actually
    // exercised — populate resource_group_ids + via_rg in the
    // store and assert items appear via that stream.
    #[tokio::test]
    async fn planner_via_resource_group_stream_merges() {
        let alice = uuid(1);
        let rg1 = uuid(21);
        let rg2 = uuid(22);
        let store = PlannerStore {
            resource_group_ids: [(alice, vec![rg1, rg2])].into(),
            via_rg: [
                (rg1, vec![item(100, 100), item(80, 102)]),
                (rg2, vec![item(90, 101)]),
            ]
            .into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            None,
            10,
            10,
        )
        .await
        .unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(100), uuid(101), uuid(102)],
            "ViaResourceGroupStream must yield items from RG_acc"
        );
    }

    // phase3-final-review A9 / QA-7: cursor past every yielded
    // item must produce an empty page + None next_cursor.
    #[tokio::test]
    async fn planner_future_cursor_yields_empty_page() {
        let alice = uuid(1);
        let store = PlannerStore {
            owned: [(alice, vec![item(100, 1), item(90, 2)])].into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let future_cursor = ListingCursor {
            sort_key: ts(50), // earlier than every item (DESC: 100 > 90 > 50)
            resource_id: uuid(0),
        };
        let page = list_visible_paginated(
            &store,
            &auth_info(),
            &subject,
            untrusted_app(),
            0,
            Some(future_cursor),
            10,
            10,
        )
        .await
        .unwrap();
        assert!(page.resource_ids.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    // phase3-final-review A10 / QA-9: stream error propagates
    // through the planner's merge.
    #[tokio::test]
    async fn planner_propagates_stream_error() {
        #[derive(Default, Debug)]
        struct ErrorOnPublic;
        #[async_trait]
        impl PolicyStore for ErrorOnPublic {
            async fn fetch_owners(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
                Ok(Default::default())
            }
            async fn fetch_direct_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_resource_group_memberships(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError>
            {
                Ok(Default::default())
            }
            async fn fetch_resource_group_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_type_level_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn stream_public_cover_resources(
                &self,
                _: &ResourceAuthInfo,
                _: AppView,
                _: u32,
                _: Option<ListingCursor>,
                _: usize,
            ) -> Result<Vec<StreamItem>, AuthError> {
                Err(AuthError::Evaluation("public stream boom".into()))
            }
        }
        let store = ErrorOnPublic;
        let result = list_visible_paginated(
            &store,
            &auth_info(),
            &Subject::Anonymous,
            untrusted_app(),
            0,
            None,
            10,
            10,
        )
        .await;
        assert!(
            result.is_err(),
            "planner must propagate the Public stream's error"
        );
    }

    // phase3-final-review A11 / TECH-1 / QA-4: OwnerOnly fast
    // path (trusted app + authenticated caller) must paginate
    // with the cursor too — the test
    // planner_owner_only_fast_path_under_trusted_app only
    // exercises the no-cursor case.
    //
    // Cursor semantics: a FULL page returns Some(cursor)
    // unconditionally (the merge doesn't know whether more items
    // exist after the page). The caller's next request returns
    // an empty page + None when the underlying stream is exhausted.
    #[tokio::test]
    async fn planner_owner_only_fast_path_paginates_with_cursor() {
        let alice = uuid(1);
        let store = PlannerStore {
            owned: [(
                alice,
                vec![item(100, 1), item(90, 2), item(80, 3), item(70, 4)],
            )]
            .into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let info = auth_info();

        let page1 = list_visible_paginated(
            &store, &info, &subject, trusted_app(), 0, None, 2, 10,
        )
        .await
        .unwrap();
        assert_eq!(page1.resource_ids, vec![uuid(1), uuid(2)]);
        assert!(page1.next_cursor.is_some());

        let page2 = list_visible_paginated(
            &store,
            &info,
            &subject,
            trusted_app(),
            0,
            page1.next_cursor,
            2,
            10,
        )
        .await
        .unwrap();
        assert_eq!(page2.resource_ids, vec![uuid(3), uuid(4)]);
        // Full page → cursor returned even though the underlying
        // OwnedStream happens to be exhausted; the merge can't
        // tell. Third call confirms exhaustion.
        assert!(page2.next_cursor.is_some());

        let page3 = list_visible_paginated(
            &store,
            &info,
            &subject,
            trusted_app(),
            0,
            page2.next_cursor,
            2,
            10,
        )
        .await
        .unwrap();
        assert!(page3.resource_ids.is_empty());
        assert_eq!(page3.next_cursor, None);
    }

    #[tokio::test]
    async fn planner_paginates_with_cursor() {
        let alice = uuid(1);
        let store = PlannerStore {
            owned: [(
                alice,
                vec![
                    item(100, 1),
                    item(90, 2),
                    item(80, 3),
                    item(70, 4),
                    item(60, 5),
                ],
            )]
            .into(),
            ..Default::default()
        };
        let subject = Subject::user(alice, vec![]);
        let info = auth_info();

        let page1 = list_visible_paginated(
            &store, &info, &subject, untrusted_app(), 0, None, 2, 10,
        )
        .await
        .unwrap();
        assert_eq!(page1.resource_ids, vec![uuid(1), uuid(2)]);

        let page2 = list_visible_paginated(
            &store,
            &info,
            &subject,
            untrusted_app(),
            0,
            page1.next_cursor,
            2,
            10,
        )
        .await
        .unwrap();
        assert_eq!(page2.resource_ids, vec![uuid(3), uuid(4)]);

        let page3 = list_visible_paginated(
            &store,
            &info,
            &subject,
            untrusted_app(),
            0,
            page2.next_cursor,
            2,
            10,
        )
        .await
        .unwrap();
        assert_eq!(page3.resource_ids, vec![uuid(5)]);
        assert_eq!(page3.next_cursor, None);
    }
}

#[cfg(test)]
mod via_resource_group_stream_tests {
    //! Validate ViaResourceGroupStream behaves like the other
    //! resource-id paginated streams: DESC walk, refill on drain,
    //! short-circuit on empty group list, store-error propagation.
    use super::*;
    use crate::registry::ResourceAuthInfo;
    use async_trait::async_trait;

    #[derive(Default, Debug)]
    struct VRGStore {
        /// (resource_group_id, list of resources in that group)
        items_by_group: std::collections::HashMap<Uuid, Vec<StreamItem>>,
    }

    #[async_trait]
    impl PolicyStore for VRGStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn stream_via_resource_group_resources(
            &self,
            _: &ResourceAuthInfo,
            resource_group_ids: &[Uuid],
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            // Union over every group the caller passes; dedup by
            // resource_id (a resource may live in multiple groups).
            let mut all: Vec<StreamItem> = resource_group_ids
                .iter()
                .flat_map(|g| {
                    self.items_by_group.get(g).cloned().unwrap_or_default()
                })
                .collect();
            all.sort_by(|a, b| {
                b.sort_key
                    .cmp(&a.sort_key)
                    .then_with(|| b.resource_id.cmp(&a.resource_id))
            });
            all.dedup_by_key(|i| i.resource_id);
            let mut filtered: Vec<StreamItem> = all
                .into_iter()
                .filter(|it| match cursor {
                    Some(c) => {
                        let cmp = it
                            .sort_key
                            .cmp(&c.sort_key)
                            .then_with(|| it.resource_id.cmp(&c.resource_id));
                        cmp == std::cmp::Ordering::Less
                    }
                    None => true,
                })
                .collect();
            filtered.truncate(batch_size);
            Ok(filtered)
        }
    }

    fn ts(s: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(s, 0).unwrap().naive_utc()
    }
    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }
    fn auth_info() -> ResourceAuthInfo {
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
    async fn drain<S: SortedStream + ?Sized>(stream: &mut S) -> Vec<Uuid> {
        let mut out = Vec::new();
        while let Some(it) = stream.next().await.unwrap() {
            out.push(it.resource_id);
        }
        out
    }

    #[tokio::test]
    async fn via_rg_stream_walks_desc_across_groups() {
        let g1 = uuid(11);
        let g2 = uuid(12);
        let mut store = VRGStore::default();
        store.items_by_group.insert(
            g1,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(1) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(3) },
            ],
        );
        store.items_by_group.insert(
            g2,
            vec![
                StreamItem { sort_key: ts(90), resource_id: uuid(2) },
                StreamItem { sort_key: ts(70), resource_id: uuid(4) },
            ],
        );
        let info = auth_info();
        let groups = [g1, g2];
        let mut s =
            ViaResourceGroupStream::new(&store, &info, &groups, None, 100);
        assert_eq!(
            drain(&mut s).await,
            vec![uuid(1), uuid(2), uuid(3), uuid(4)]
        );
        assert_eq!(s.source(), StreamSource::ViaResourceGroup);
    }

    #[tokio::test]
    async fn via_rg_stream_empty_groups_short_circuits() {
        let store = VRGStore::default();
        let info = auth_info();
        let groups: [Uuid; 0] = [];
        let mut s =
            ViaResourceGroupStream::new(&store, &info, &groups, None, 10);
        assert!(s.next().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn via_rg_stream_dedups_resource_in_multiple_groups() {
        // Resource 1 is in both g1 and g2 → must yield once.
        let g1 = uuid(11);
        let g2 = uuid(12);
        let mut store = VRGStore::default();
        store.items_by_group.insert(
            g1,
            vec![StreamItem { sort_key: ts(100), resource_id: uuid(1) }],
        );
        store.items_by_group.insert(
            g2,
            vec![StreamItem { sort_key: ts(100), resource_id: uuid(1) }],
        );
        let info = auth_info();
        let groups = [g1, g2];
        let mut s =
            ViaResourceGroupStream::new(&store, &info, &groups, None, 10);
        assert_eq!(drain(&mut s).await, vec![uuid(1)]);
    }
}

#[cfg(test)]
mod cover_stream_tests {
    //! Validate the three cover-backed streams behave like the
    //! other streams (DESC walk, error propagation, exhaustion).
    //! The PolicyStore stub serves canned cover-row batches.
    use super::*;
    use crate::registry::ResourceAuthInfo;
    use async_trait::async_trait;

    #[derive(Default, Debug)]
    struct CoverStore {
        public: Vec<StreamItem>,
        server_member: Vec<StreamItem>,
        groups: std::collections::HashMap<Uuid, Vec<StreamItem>>,
    }

    #[async_trait]
    impl PolicyStore for CoverStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn stream_public_cover_resources(
            &self,
            _: &ResourceAuthInfo,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(&self.public, cursor, batch_size))
        }
        async fn stream_server_member_cover_resources(
            &self,
            _: &ResourceAuthInfo,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            Ok(slice_after_cursor(&self.server_member, cursor, batch_size))
        }
        async fn stream_large_user_group_cover_resources(
            &self,
            _: &ResourceAuthInfo,
            user_group_id: &Uuid,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            let v = self.groups.get(user_group_id).cloned().unwrap_or_default();
            Ok(slice_after_cursor(&v, cursor, batch_size))
        }
    }

    fn slice_after_cursor(
        items: &[StreamItem],
        cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Vec<StreamItem> {
        let mut sorted: Vec<StreamItem> = items.iter().cloned().collect();
        sorted.sort_by(|a, b| {
            b.sort_key
                .cmp(&a.sort_key)
                .then_with(|| b.resource_id.cmp(&a.resource_id))
        });
        let mut filtered: Vec<StreamItem> = sorted
            .into_iter()
            .filter(|it| match cursor {
                Some(c) => {
                    let cmp = it
                        .sort_key
                        .cmp(&c.sort_key)
                        .then_with(|| it.resource_id.cmp(&c.resource_id));
                    cmp == std::cmp::Ordering::Less
                }
                None => true,
            })
            .collect();
        filtered.truncate(batch_size);
        filtered
    }

    fn ts(s: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(s, 0).unwrap().naive_utc()
    }
    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }
    fn auth_info() -> ResourceAuthInfo {
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
    fn app() -> AppView {
        AppView { id: uuid(99), trusted: false }
    }
    async fn drain<S: SortedStream + ?Sized>(stream: &mut S) -> Vec<Uuid> {
        let mut out = Vec::new();
        while let Some(it) = stream.next().await.unwrap() {
            out.push(it.resource_id);
        }
        out
    }

    #[tokio::test]
    async fn public_cover_stream_walks_desc() {
        let store = CoverStore {
            public: vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(1) },
                StreamItem { sort_key: ts(90),  resource_id: uuid(2) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(3) },
            ],
            ..Default::default()
        };
        let info = auth_info();
        let mut s = PublicCoverStream::new(&store, &info, app(), 0, None, 2);
        assert_eq!(drain(&mut s).await, vec![uuid(1), uuid(2), uuid(3)]);
        assert_eq!(s.source(), StreamSource::PublicMaterialized);
    }

    #[tokio::test]
    async fn server_member_cover_stream_walks_desc() {
        let store = CoverStore {
            server_member: vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(10) },
                StreamItem { sort_key: ts(90),  resource_id: uuid(20) },
            ],
            ..Default::default()
        };
        let info = auth_info();
        let mut s = ServerMemberCoverStream::new(&store, &info, app(), 0, None, 10);
        assert_eq!(drain(&mut s).await, vec![uuid(10), uuid(20)]);
        assert_eq!(s.source(), StreamSource::ServerMemberMaterialized);
    }

    #[tokio::test]
    async fn large_user_group_cover_stream_walks_per_group() {
        let g1 = uuid(11);
        let g2 = uuid(12);
        let mut store = CoverStore::default();
        store.groups.insert(
            g1,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(1) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(3) },
            ],
        );
        store.groups.insert(
            g2,
            vec![StreamItem { sort_key: ts(90), resource_id: uuid(2) }],
        );
        let info = auth_info();
        let mut s = LargeUserGroupCoverStream::new(&store, &info, g1, app(), 0, None, 10);
        // Group g1 only — must NOT include g2 items.
        assert_eq!(drain(&mut s).await, vec![uuid(1), uuid(3)]);
    }

    #[tokio::test]
    async fn cover_streams_propagate_store_errors() {
        struct E;
        #[async_trait]
        impl PolicyStore for E {
            async fn fetch_owners(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
                Ok(Default::default())
            }
            async fn fetch_direct_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_resource_group_memberships(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError>
            {
                Ok(Default::default())
            }
            async fn fetch_resource_group_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_type_level_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn stream_public_cover_resources(
                &self,
                _: &ResourceAuthInfo,
                _: AppView,
                _: u32,
                _: Option<ListingCursor>,
                _: usize,
            ) -> Result<Vec<StreamItem>, AuthError> {
                Err(AuthError::Evaluation("cover boom".into()))
            }
        }
        let store = E;
        let info = auth_info();
        let mut s = PublicCoverStream::new(&store, &info, app(), 0, None, 10);
        assert!(s.next().await.is_err());
    }
}

#[cfg(test)]
mod direct_stream_tests {
    //! Mirror of owned_stream_tests for the direct-user and
    //! direct-user-group sources. Same mock-store pattern; the
    //! cursor + refill + propagation contracts are identical.
    use super::*;
    use crate::registry::ResourceAuthInfo;
    use async_trait::async_trait;

    #[derive(Default, Debug)]
    struct MockDirectStore {
        user_items: std::collections::HashMap<Uuid, Vec<StreamItem>>,
        group_items: std::collections::HashMap<Uuid, Vec<StreamItem>>,
    }

    #[async_trait]
    impl PolicyStore for MockDirectStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn stream_direct_user_resources(
            &self,
            _: &ResourceAuthInfo,
            user_id: &Uuid,
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            let all = self.user_items.get(user_id).cloned().unwrap_or_default();
            Ok(filter_paginate(all, cursor, batch_size))
        }
        async fn stream_direct_user_group_resources(
            &self,
            _: &ResourceAuthInfo,
            group_ids: &[Uuid],
            _: AppView,
            _: u32,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            // Union over every group the caller belongs to.
            let mut all: Vec<StreamItem> = group_ids
                .iter()
                .flat_map(|g| self.group_items.get(g).cloned().unwrap_or_default())
                .collect();
            // Dedup by resource_id (a single resource may be shared
            // with multiple of the caller's groups).
            all.sort_by(|a, b| {
                b.sort_key
                    .cmp(&a.sort_key)
                    .then_with(|| b.resource_id.cmp(&a.resource_id))
            });
            all.dedup_by_key(|i| i.resource_id);
            Ok(filter_paginate(all, cursor, batch_size))
        }
    }

    fn filter_paginate(
        mut items: Vec<StreamItem>,
        cursor: Option<ListingCursor>,
        batch_size: usize,
    ) -> Vec<StreamItem> {
        items.sort_by(|a, b| {
            b.sort_key
                .cmp(&a.sort_key)
                .then_with(|| b.resource_id.cmp(&a.resource_id))
        });
        let mut out: Vec<StreamItem> = items
            .into_iter()
            .filter(|it| match cursor {
                Some(c) => {
                    let cmp = it
                        .sort_key
                        .cmp(&c.sort_key)
                        .then_with(|| it.resource_id.cmp(&c.resource_id));
                    cmp == std::cmp::Ordering::Less
                }
                None => true,
            })
            .collect();
        out.truncate(batch_size);
        out
    }

    fn ts(s: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(s, 0).unwrap().naive_utc()
    }
    fn uuid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }
    fn auth_info() -> ResourceAuthInfo {
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
    fn app() -> AppView {
        AppView { id: uuid(99), trusted: false }
    }
    async fn drain<S: SortedStream + ?Sized>(stream: &mut S) -> Vec<Uuid> {
        let mut out = Vec::new();
        while let Some(it) = stream.next().await.unwrap() {
            out.push(it.resource_id);
        }
        out
    }

    #[tokio::test]
    async fn direct_user_stream_walks_items_in_desc_order() {
        let bob = uuid(1);
        let mut store = MockDirectStore::default();
        store.user_items.insert(
            bob,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(10) },
                StreamItem { sort_key: ts(90),  resource_id: uuid(20) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(30) },
            ],
        );
        let info = auth_info();
        let mut stream =
            DirectUserStream::new(&store, &info, bob, app(), 0, None, 2);
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(10), uuid(20), uuid(30)]);
        assert_eq!(stream.source(), StreamSource::DirectUser);
    }

    #[tokio::test]
    async fn direct_user_stream_propagates_store_errors() {
        struct E;
        #[async_trait]
        impl PolicyStore for E {
            async fn fetch_owners(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
                Ok(Default::default())
            }
            async fn fetch_direct_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_resource_group_memberships(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError>
            {
                Ok(Default::default())
            }
            async fn fetch_resource_group_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_type_level_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn stream_direct_user_resources(
                &self,
                _: &ResourceAuthInfo,
                _: &Uuid,
                _: AppView,
                _: u32,
                _: Option<ListingCursor>,
                _: usize,
            ) -> Result<Vec<StreamItem>, AuthError> {
                Err(AuthError::Evaluation("boom".into()))
            }
        }
        let store = E;
        let info = auth_info();
        let mut stream = DirectUserStream::new(&store, &info, uuid(1), app(), 0, None, 10);
        assert!(stream.next().await.is_err());
    }

    #[tokio::test]
    async fn direct_user_group_stream_unions_groups_in_desc_order() {
        let g1 = uuid(11);
        let g2 = uuid(12);
        let mut store = MockDirectStore::default();
        store.group_items.insert(
            g1,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(1) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(3) },
            ],
        );
        store.group_items.insert(
            g2,
            vec![
                StreamItem { sort_key: ts(90),  resource_id: uuid(2) },
                StreamItem { sort_key: ts(70),  resource_id: uuid(4) },
            ],
        );
        let info = auth_info();
        let groups = [g1, g2];
        let mut stream = DirectUserGroupStream::new(
            &store, &info, &groups, app(), 0, None, 100,
        );
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(1), uuid(2), uuid(3), uuid(4)]);
        assert_eq!(stream.source(), StreamSource::DirectUserGroup);
    }

    #[tokio::test]
    async fn direct_user_group_stream_empty_group_list_short_circuits() {
        // No groups → exhausted from the start; no store round trip.
        let store = MockDirectStore::default();
        let info = auth_info();
        let groups: [Uuid; 0] = [];
        let mut stream = DirectUserGroupStream::new(
            &store, &info, &groups, app(), 0, None, 100,
        );
        assert!(stream.next().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn direct_user_group_stream_dedups_shared_resource_across_groups() {
        // Resource 1 is shared with BOTH groups the caller belongs
        // to. The store dedups; the stream surfaces it once.
        let g1 = uuid(11);
        let g2 = uuid(12);
        let mut store = MockDirectStore::default();
        store.group_items.insert(
            g1,
            vec![StreamItem { sort_key: ts(100), resource_id: uuid(1) }],
        );
        store.group_items.insert(
            g2,
            vec![StreamItem { sort_key: ts(100), resource_id: uuid(1) }],
        );
        let info = auth_info();
        let groups = [g1, g2];
        let mut stream = DirectUserGroupStream::new(
            &store, &info, &groups, app(), 0, None, 100,
        );
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(1)]);
    }
}

#[cfg(test)]
mod owned_stream_tests {
    //! Validate the OwnedStream refill loop + cursor advancement
    //! against a mock store. End-to-end against a real postgres
    //! lands in the filez integration tests when the impl arrives.

    use super::*;
    use crate::registry::ResourceAuthInfo;
    use async_trait::async_trait;

    /// Mock store with a pre-seeded list of owned items per
    /// `user_id`. Returns batches matching the cursor + batch_size
    /// contract: items strictly past the cursor in DESC order,
    /// capped at batch_size.
    #[derive(Default, Debug)]
    struct MockStore {
        items_by_user: std::collections::HashMap<Uuid, Vec<StreamItem>>,
    }

    #[async_trait]
    impl PolicyStore for MockStore {
        async fn fetch_owners(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_direct_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_resource_group_memberships(
            &self,
            _: &ResourceAuthInfo,
            _: &[Uuid],
        ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError> {
            Ok(Default::default())
        }
        async fn fetch_resource_group_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
            _: &[Uuid],
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn fetch_type_level_policies(
            &self,
            _: &ResourceAuthInfo,
            _: &Subject,
            _: AppView,
            _: u32,
        ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
            Ok(vec![])
        }
        async fn stream_owned_resources(
            &self,
            _auth_info: &ResourceAuthInfo,
            user_id: &Uuid,
            cursor: Option<ListingCursor>,
            batch_size: usize,
        ) -> Result<Vec<StreamItem>, AuthError> {
            let all = self
                .items_by_user
                .get(user_id)
                .cloned()
                .unwrap_or_default();
            let mut filtered: Vec<StreamItem> = all
                .into_iter()
                .filter(|it| match cursor {
                    Some(c) => {
                        let cmp = it
                            .sort_key
                            .cmp(&c.sort_key)
                            .then_with(|| it.resource_id.cmp(&c.resource_id));
                        cmp == std::cmp::Ordering::Less
                    }
                    None => true,
                })
                .collect();
            // Mock store guarantees DESC order; trim to batch_size.
            filtered.sort_by(|a, b| {
                b.sort_key
                    .cmp(&a.sort_key)
                    .then_with(|| b.resource_id.cmp(&a.resource_id))
            });
            filtered.truncate(batch_size);
            Ok(filtered)
        }
    }

    fn ts(s: i64) -> chrono::NaiveDateTime {
        chrono::DateTime::from_timestamp(s, 0).unwrap().naive_utc()
    }
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

    async fn drain<S: SortedStream + ?Sized>(stream: &mut S) -> Vec<Uuid> {
        let mut out = Vec::new();
        while let Some(it) = stream.next().await.unwrap() {
            out.push(it.resource_id);
        }
        out
    }

    #[tokio::test]
    async fn owned_stream_yields_items_in_desc_order() {
        let user = uuid(1);
        let mut store = MockStore::default();
        store.items_by_user.insert(
            user,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(10) },
                StreamItem { sort_key: ts(90),  resource_id: uuid(20) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(30) },
            ],
        );
        let auth_info = auth_info_for_files();
        let mut stream = OwnedStream::new(&store, &auth_info, user, None, 2);
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(10), uuid(20), uuid(30)]);
    }

    #[tokio::test]
    async fn owned_stream_refills_when_buffer_drains() {
        // 5 items, batch_size 2 → must refill twice.
        let user = uuid(1);
        let mut store = MockStore::default();
        store.items_by_user.insert(
            user,
            (1..=5)
                .map(|i| StreamItem {
                    sort_key: ts(100 - i),
                    resource_id: uuid(i as u128),
                })
                .collect(),
        );
        let auth_info = auth_info_for_files();
        let mut stream = OwnedStream::new(&store, &auth_info, user, None, 2);
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)]);
    }

    #[tokio::test]
    async fn owned_stream_respects_initial_cursor() {
        let user = uuid(1);
        let mut store = MockStore::default();
        store.items_by_user.insert(
            user,
            (1..=5)
                .map(|i| StreamItem {
                    sort_key: ts(100 - i),
                    resource_id: uuid(i as u128),
                })
                .collect(),
        );
        let auth_info = auth_info_for_files();
        // Initial cursor at item #2 → next page should start at #3.
        let cursor = ListingCursor {
            sort_key: ts(99 - 1),
            resource_id: uuid(2),
        };
        let mut stream = OwnedStream::new(&store, &auth_info, user, Some(cursor), 10);
        let ids = drain(&mut stream).await;
        assert_eq!(ids, vec![uuid(3), uuid(4), uuid(5)]);
    }

    #[tokio::test]
    async fn owned_stream_empty_for_unknown_user() {
        let store = MockStore::default();
        let auth_info = auth_info_for_files();
        let mut stream = OwnedStream::new(&store, &auth_info, uuid(99), None, 10);
        assert!(stream.next().await.unwrap().is_none());
    }

    // phase3-review A8 / QA-5: store errors must surface through
    // OwnedStream::next, not be masked into an empty stream.
    #[tokio::test]
    async fn owned_stream_propagates_store_errors() {
        struct ErrorStore;
        #[async_trait]
        impl PolicyStore for ErrorStore {
            async fn fetch_owners(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Uuid>, AuthError> {
                Ok(Default::default())
            }
            async fn fetch_direct_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_resource_group_memberships(
                &self,
                _: &ResourceAuthInfo,
                _: &[Uuid],
            ) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>, AuthError>
            {
                Ok(Default::default())
            }
            async fn fetch_resource_group_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
                _: &[Uuid],
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn fetch_type_level_policies(
                &self,
                _: &ResourceAuthInfo,
                _: &Subject,
                _: AppView,
                _: u32,
            ) -> Result<Vec<crate::policies::PolicyView>, AuthError> {
                Ok(vec![])
            }
            async fn stream_owned_resources(
                &self,
                _: &ResourceAuthInfo,
                _: &Uuid,
                _: Option<ListingCursor>,
                _: usize,
            ) -> Result<Vec<StreamItem>, AuthError> {
                Err(AuthError::Evaluation("simulated store failure".into()))
            }
        }
        let store = ErrorStore;
        let auth_info = auth_info_for_files();
        let mut stream = OwnedStream::new(&store, &auth_info, uuid(1), None, 10);
        assert!(stream.next().await.is_err(), "store error must propagate");
    }

    #[tokio::test]
    async fn owned_stream_feeds_merge_correctly() {
        // OwnedStream + a second in-memory stream → merge sees DESC
        // interleave. Validates the trait wiring against the heap.
        let user = uuid(1);
        let mut store = MockStore::default();
        store.items_by_user.insert(
            user,
            vec![
                StreamItem { sort_key: ts(100), resource_id: uuid(10) },
                StreamItem { sort_key: ts(80),  resource_id: uuid(30) },
            ],
        );
        let auth_info = auth_info_for_files();

        // Inline VecStream because the merge_tests helper is private.
        struct VecStream {
            items: std::collections::VecDeque<StreamItem>,
        }
        #[async_trait]
        impl SortedStream for VecStream {
            fn source(&self) -> StreamSource {
                StreamSource::PublicMaterialized
            }
            async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
                Ok(self.items.pop_front())
            }
        }

        let public_stream = VecStream {
            items: vec![
                StreamItem { sort_key: ts(90), resource_id: uuid(20) },
                StreamItem { sort_key: ts(70), resource_id: uuid(40) },
            ]
            .into(),
        };

        let mut streams: Vec<Box<dyn SortedStream>> = vec![
            Box::new(OwnedStream::new(&store, &auth_info, user, None, 10)),
            Box::new(public_stream),
        ];
        let page = merge_streams(&mut streams, None, 100).await.unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(10), uuid(20), uuid(30), uuid(40)]
        );
    }
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

    /// Stream that always yields `None` — never produced any items.
    struct EmptyStream;
    #[async_trait]
    impl SortedStream for EmptyStream {
        fn source(&self) -> StreamSource {
            StreamSource::Owned
        }
        async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
            Ok(None)
        }
    }

    /// Stream that yields N items then errors on the next call.
    struct ErrorAfterStream {
        remaining: VecDeque<StreamItem>,
    }
    #[async_trait]
    impl SortedStream for ErrorAfterStream {
        fn source(&self) -> StreamSource {
            StreamSource::Owned
        }
        async fn next(&mut self) -> Result<Option<StreamItem>, AuthError> {
            if let Some(it) = self.remaining.pop_front() {
                Ok(Some(it))
            } else {
                Err(AuthError::Evaluation("simulated stream failure".into()))
            }
        }
    }

    // phase3-review A7 / QA-1: every stream returns None on first
    // call → page must be empty + cursor None, no spin.
    #[tokio::test]
    async fn all_streams_initially_exhausted_returns_empty_page() {
        let mut streams: Vec<Box<dyn SortedStream>> = vec![
            Box::new(EmptyStream),
            Box::new(EmptyStream),
            Box::new(EmptyStream),
        ];
        let page = merge_streams(&mut streams, None, 50).await.unwrap();
        assert!(page.resource_ids.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    // phase3-review A11 / QA-4: page_size = 0 is a caller bug;
    // return empty rather than spin.
    #[tokio::test]
    async fn page_size_zero_returns_empty_page_immediately() {
        let mut streams = vec![stream(
            StreamSource::Owned,
            vec![(100, 1), (90, 2)],
        )];
        let page = merge_streams(&mut streams, None, 0).await.unwrap();
        assert!(page.resource_ids.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    // phase3-review A6 / QA-2: stream error mid-page must propagate
    // immediately, not be silently dropped.
    #[tokio::test]
    async fn stream_error_mid_page_propagates() {
        let mut streams: Vec<Box<dyn SortedStream>> = vec![
            Box::new(ErrorAfterStream {
                remaining: vec![StreamItem {
                    sort_key: ts(100),
                    resource_id: uuid(1),
                }]
                .into(),
            }),
            stream(StreamSource::PublicMaterialized, vec![(90, 2)]),
        ];
        let result = merge_streams(&mut streams, None, 50).await;
        assert!(
            result.is_err(),
            "merge_streams must propagate the inner stream's error"
        );
    }

    /// DenyChecker that flags a fixed set of resource_ids.
    struct DenyList {
        denied: std::collections::HashSet<Uuid>,
        /// Tracks which (resource_id, source) pairs were checked.
        /// Lets the owner-skip test verify the optimisation fires.
        checked: std::sync::Mutex<Vec<(Uuid, StreamSource)>>,
    }
    impl DenyList {
        fn new(denied_ids: &[Uuid]) -> Self {
            Self {
                denied: denied_ids.iter().copied().collect(),
                checked: std::sync::Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait]
    impl DenyChecker for DenyList {
        async fn is_denied(
            &self,
            item: &StreamItem,
            source: StreamSource,
        ) -> Result<bool, AuthError> {
            self.checked
                .lock()
                .unwrap()
                .push((item.resource_id, source));
            Ok(self.denied.contains(&item.resource_id))
        }
    }

    /// DenyChecker that errors on every call — verifies the merge
    /// propagates checker errors.
    struct DenyError;
    #[async_trait]
    impl DenyChecker for DenyError {
        async fn is_denied(
            &self,
            _item: &StreamItem,
            _source: StreamSource,
        ) -> Result<bool, AuthError> {
            Err(AuthError::Evaluation("deny check boom".into()))
        }
    }

    // phase3-review A2 / LISTING.md §5.3: items the DenyChecker
    // flags are silently skipped; the cursor still advances past
    // them so the next page picks up correctly.
    #[tokio::test]
    async fn deny_check_filters_candidates() {
        let mut streams = vec![stream(
            StreamSource::PublicMaterialized,
            vec![(100, 1), (90, 2), (80, 3), (70, 4)],
        )];
        let checker = DenyList::new(&[uuid(2), uuid(3)]);
        let page = merge_streams_with_deny_check(&mut streams, None, 10, Some(&checker))
            .await
            .unwrap();
        assert_eq!(
            page.resource_ids,
            vec![uuid(1), uuid(4)],
            "Denied items 2 + 3 must be skipped"
        );
    }

    // LISTING.md §5.3 optimisation: owner-sourced items skip the
    // Deny check (ownership is never Denied). The wrapper's
    // matches!(source, Owned) guard prevents the store call.
    #[tokio::test]
    async fn owner_source_skips_deny_check() {
        struct OwnerSkipChecker {
            // Owner-sourced items must not reach this checker at
            // all; if they do, we panic.
            inner_checked: std::sync::Mutex<Vec<StreamSource>>,
        }
        #[async_trait]
        impl DenyChecker for OwnerSkipChecker {
            async fn is_denied(
                &self,
                _item: &StreamItem,
                source: StreamSource,
            ) -> Result<bool, AuthError> {
                self.inner_checked.lock().unwrap().push(source);
                Ok(false)
            }
        }
        // Wrapper that mimics PolicyStoreDenyChecker's owner-skip.
        struct OwnerSkipWrapper(OwnerSkipChecker);
        #[async_trait]
        impl DenyChecker for OwnerSkipWrapper {
            async fn is_denied(
                &self,
                item: &StreamItem,
                source: StreamSource,
            ) -> Result<bool, AuthError> {
                if matches!(source, StreamSource::Owned) {
                    return Ok(false);
                }
                self.0.is_denied(item, source).await
            }
        }
        let wrapper = OwnerSkipWrapper(OwnerSkipChecker {
            inner_checked: std::sync::Mutex::new(Vec::new()),
        });
        let mut streams = vec![
            stream(StreamSource::Owned, vec![(100, 1), (80, 3)]),
            stream(StreamSource::PublicMaterialized, vec![(90, 2)]),
        ];
        let page = merge_streams_with_deny_check(&mut streams, None, 10, Some(&wrapper))
            .await
            .unwrap();
        assert_eq!(page.resource_ids, vec![uuid(1), uuid(2), uuid(3)]);
        let inner_checks = wrapper.0.inner_checked.lock().unwrap();
        // Owner-sourced items (1, 3) skipped → only Public item 2
        // hit the inner checker.
        assert_eq!(inner_checks.len(), 1);
        assert_eq!(inner_checks[0], StreamSource::PublicMaterialized);
    }

    #[tokio::test]
    async fn deny_check_errors_propagate() {
        let mut streams = vec![stream(
            StreamSource::PublicMaterialized,
            vec![(100, 1)],
        )];
        let checker = DenyError;
        let result =
            merge_streams_with_deny_check(&mut streams, None, 10, Some(&checker)).await;
        assert!(result.is_err());
    }

    // Cursor MUST advance past skipped items so the next page
    // picks up correctly (not loop on the same Denied row).
    #[tokio::test]
    async fn next_cursor_carries_past_denied_items() {
        let mut streams = vec![stream(
            StreamSource::PublicMaterialized,
            vec![(100, 1), (90, 2), (80, 3)],
        )];
        let checker = DenyList::new(&[uuid(2)]);
        // page_size=2, item 2 denied → page returns [1, 3], cursor
        // at the last YIELDED item (3).
        let page = merge_streams_with_deny_check(&mut streams, None, 2, Some(&checker))
            .await
            .unwrap();
        assert_eq!(page.resource_ids, vec![uuid(1), uuid(3)]);
        assert_eq!(
            page.next_cursor,
            Some(ListingCursor {
                sort_key: ts(80),
                resource_id: uuid(3),
            }),
            "cursor must be the last YIELDED item, not the last popped"
        );
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
