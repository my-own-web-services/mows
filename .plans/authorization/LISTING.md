# LISTING — Solving the "What can I see?" Problem at Scale

> *A single query for: "Is user A allowed to read Object B using App C" is
> easy, the question: "What objects has user A access to using App C" is
> difficult.* — IDEA.md

This document picks a concrete strategy, **proves it scales to the target
shape (10k users, 10M resources, mixed sharing density)**, and defines
what we instrument so we know when it stops scaling.

## 1. Scale targets and observed distribution

Design must work for at least:

| Dimension                                  | Target                |
| ------------------------------------------ | --------------------- |
| Users                                      | 10,000                |
| Resources of one type (e.g. files)         | 10,000,000            |
| Active access policies                     | 1,000,000             |
| User-groups per user (average)             | 5                     |
| Members in a large user-group (p99)        | 1,000                 |
| Resource-groups (e.g. file_groups)         | 100,000               |
| Members in a large resource-group (p99)    | 100,000               |
| Public-shared resources                    | 1,000,000             |
| ServerMember-shared resources              | 5,000,000             |

The observed *distribution* — confirmed by Paul's framing — is heavily
skewed in one direction:

> **Most resources are owned by the user listing them.**

A typical user owns ~1,000 of their own files and has ~100 things
shared with them by other users. They occasionally land on a page that
includes Public material. The combined-everything-I-can-see surface
exists but is rare in active UI flows.

This is the single most important fact for the design. **The dominant
listing query is "list my own things, ordered by recency" — and that
query must not pay any auth-engine cost.** It's a plain
`WHERE owner_id = $me ORDER BY created_time DESC LIMIT 50` against an
existing composite index, no JOIN to policies, no UNION, no EXCEPT.
Everything we add for sharing must preserve that property for the
owner case.

The auth-mediated path carries the remaining cases:

- Shared-with-me directly (small per user: 10s–100s of items)
- Shared-with-a-group-I-belong-to (varies, can spike to 10k+)
- Public / ServerMember (large absolute counts, but small *per user*
  in practice because no one paginates all 1M public files; they
  filter or search)
- OwnedByOwner / AccessibleByOwner (rare, by design)

## 2. Why my first sketch (`UNION + EXCEPT` materialisation) breaks

The earlier draft of this file proposed:

```sql
WITH owned AS (...), direct AS (...), via_group AS (...),
     owned_by_owner AS (...), accessible_by_owner AS (...),
     all_allow AS (UNION of above WHERE effect = 1),
     all_deny  AS (UNION of above WHERE effect = 0)
SELECT … FROM resources WHERE id IN (all_allow EXCEPT all_deny)
ORDER BY … LIMIT … OFFSET …;
```

At the target scale this falls over in four distinct ways:

1. **The owned CTE materialises ~1,000 rows for a typical user — fine.
   The problem is the *plan*.** Postgres treats the EXCEPT subquery as
   an opaque set and cannot push the `ORDER BY created_time DESC LIMIT
   50` predicate down to the `files(owner_id, created_time DESC)`
   index. So the owner sees their *own* files via a path that
   materialises 1,000 ids, then JOINs back to files, then sorts. That
   is two orders of magnitude slower than the trivial
   `WHERE owner_id = $me ORDER BY created_time DESC LIMIT 50`.

2. **Public/ServerMember-mediated access blows up the union.**
   If 1M files are shared as Public, every list call materialises a
   1M-row CTE just from the Public branch. The hash for the EXCEPT
   spills to disk.

3. **OFFSET pagination needs the total count.** `count(*)` over the
   EXCEPT result is a full scan. At 10M it is multi-second per call.

4. **`accessible_by_owner_expansion` at the per-resource granularity
   doesn't fit.** A single AccessibleByOwner policy whose owner can
   see 1M things produces 1M expansion rows. Multiplied across
   policies the table becomes unbounded.

So the first sketch was for a smaller world. The redesign below
removes every one of those failure modes.

## 3. The redesigned strategy

Three principles, in priority order:

1. **The owner path is direct table access, but it stays inside the
   primitive.** The engine recognises the scope and runs the indexed
   owner query itself. No policy-table touches. The handler calls the
   same `list_visible(...)` function as every other path and gets the
   same `Vec<(resource_id, sort_key)>` shape — the handler never
   composes SQL with a returned fragment. (Earlier drafts described
   this as returning an SQL fragment; that anti-pattern was rejected
   per ARCHITECTURE.md §3.7a — the single-primitive rule.)

2. **The non-owner path is a sorted stream merge with keyset
   pagination — no full materialisation, no OFFSET.** Each access
   source becomes a *sorted cursor* over `(sort_key, resource_id)`.
   A k-way merge yields the page; Deny is checked per-candidate, not
   as a set EXCEPT. The stream stops as soon as we have `page_size`
   rows.

3. **The two pathological sources (Public, ServerMember, and large
   groups) get *covering* materialised tables, keyed for sort order.**
   These cover the access-source step of the merge with an `O(page
   size)` scan instead of touching the policy table at all.

I describe each below.

## 3b. Implementation gotcha — query plan caching

When the primitive is implemented in Postgres (for the RLS defence
layer, or for services that prefer SQL over Rust), the multi-CTE
merge query *cannot* be a plain LANGUAGE sql function: Postgres only
inlines SQL functions with a single SELECT (no CTEs, no UNION).
A LANGUAGE plpgsql function with bound parameters gets a *generic
plan* that does not push per-source `LIMIT` into the CTEs — measured
**250× slowdown** at medium scale (188 ms vs 0.75 ms inline literal).

The right shape is **PLPGSQL with `EXECUTE format(...)`**: the
function builds a fresh SQL string with literal parameter values
each call. Each call sees a custom plan. Planning cost is ~0.5 ms;
total cost stays within ~5× of the inline literal upper bound. The
Rust crate, when it executes equivalent SQL through diesel, must
either rebuild the prepared statement per parameter combination
(equivalent to EXECUTE format) or accept the generic-plan penalty.

Sanitisation note: every interpolated value is either a Postgres
integer (smallint, int), a UUID, or a timestamp. None can carry SQL
syntax. The format specifier `%L` quotes literals correctly for
each type. Validated by the security suite — there is no path from
caller input to interpolated SQL except via these typed parameters.

## 4. Owner-only as an internal fast path

**The handler never sees this.** A vast majority of "list my files"
calls take this path, but the API is the same single
`list_visible(...)` primitive (ARCHITECTURE.md §3.7a). The engine
recognises the scope and runs the fast query internally.

The recognition rules: the engine takes the OwnerOnly path when
- `scope = ScopeOwned` and `subject = requesting user`, or
- `scope = ScopeAll` and the requesting user is non-anonymous *and*
  the engine has measured that listings of this type for this user
  are owner-dominated (i.e. >95% of recent results came from the
  Owned source). This last clause is an optimisation that the engine
  may decline to apply if it cannot prove the property; the
  fallback is `ScopeAll → AuthMediated`.

The internal query the engine runs:

```sql
SELECT id, created_time
FROM   files
WHERE  owner_id = $1
  AND  (created_time, id) < ($cursor_ts, $cursor_id)   -- keyset
ORDER BY created_time DESC, id DESC
LIMIT  $page_size;
```

against the `files(owner_id, created_time DESC, id DESC)` index. No
policy lookup. No CTE. p99 < 10ms on the target size. The result is
returned to the caller as `Vec<(resource_id, sort_key)>`; the handler
performs a separate display-column fetch with
`WHERE id = ANY($1)`, which contains zero auth predicate.

Trusted-app short-circuit (POLICY_SEMANTICS.md §2.2) folds into the
engine's internal logic — the handler does not know it exists.

**Combined "owned + shared" tabs** — `scope = ScopeAll` — go through
the auth-mediated merge below, with ownership as the cheapest source
in the heap.

## 5. The non-owner path: sorted stream merge

For the auth-mediated case, the listing becomes a k-way merge of
sorted streams, one per access source. The streams are:

| Source                          | Cursor over                                                   | Index used                                                          |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `direct_user`                   | resources directly shared with `user_id`                      | `access_policies(subject_type, subject_id, resource_type) include …` |
| `direct_user_group_k`           | resources directly shared with each group `G_k` the user is in | same                                                                |
| `via_resource_group`            | resources whose containing resource-group is shared with user | join via membership table, see §5.2                                 |
| `public_materialised`           | Public-shared resources (precomputed)                         | `public_resources(resource_type, created_time DESC)`                |
| `server_member_materialised`    | ServerMember-shared resources (precomputed; only for logged-in users) | `server_member_resources(resource_type, created_time DESC)`         |
| `owned_by_owner_k`              | resources whose owner is the owner of a scoped policy targeting the user | `files(owner_id, created_time DESC)` for each unique policy.owner    |
| `accessible_by_owner_k`         | resources reachable via the recursive scope                   | uses §6 expansion                                                   |
| `owned_by_me`                   | (only when combined "owned + shared" tab is requested)        | `files(owner_id, created_time DESC)`                                |

Each stream yields tuples `(sort_key, resource_id, source_tag)`
ordered by `sort_key DESC`. A binary heap merges them. Deduplication
is by `resource_id` (a resource may appear via multiple sources;
first one wins). For each candidate we:

1. Drop if it's already been yielded in this page (small dedup set).
2. Check Deny — see §5.3 below.
3. Yield. Stop when page_size reached.

Stop conditions for the *streams*:
- A stream ends when its cursor is exhausted.
- The merge ends when either page_size resources have been yielded or
  all streams are exhausted.

### 5.1 Why this scales

Each stream is `O(log N + page_size)` per call using its index. The
merge cost is `O(page_size × log(k))` heap work. The Deny check is
`O(1)` per candidate (one indexed lookup, or zero if the candidate
is the owner — owners never have a Deny applied to themselves).

Critically: **no source ever materialises more than `page_size +
small_dedup_buffer` rows per call.** A 1M-row Public table doesn't
hurt anyone listing it; we only scan from the cursor position until
we have the page.

The owner-not-the-listing-subject case is handled cleanly: a user
walking their own files goes through §4 (no merge). A user walking
shared+public goes through the merge with the `public_materialised`
stream contributing rows fast.

### 5.2 How `via_resource_group` works without exploding

For a user U in user-groups `{G_1, …, G_m}`, the resource-groups RG
that those groups have access to are fixed per request (we fetch the
list once: `access_policies WHERE subject in (U, G_1..G_m) AND
resource_type = ResourceGroup(T)`). Call this set RG_acc, typically
small (10s to low 100s).

The stream is:

```sql
-- one query, parameterised by ($RG_acc, $cursor_ts, $cursor_id, $page_size)
SELECT  r.id, r.created_time
FROM    files r
JOIN    file_file_group_members m ON m.file_id = r.id
WHERE   m.file_group_id = ANY($RG_acc)
  AND   (r.created_time, r.id) < ($cursor_ts, $cursor_id)
ORDER   BY r.created_time DESC, r.id DESC
LIMIT   $page_size;
```

This needs an index on `file_file_group_members(file_group_id,
file_id)` (already implied by the PK) and the existing
`files(created_time DESC, id DESC)` index. Postgres uses a bitmap-or
+ index scan; for `|RG_acc|` ≤ ~50 the planner cooperates. For
larger RG_acc we fall back to per-group sub-streams, each with its
own cursor, and merge them too — the merge already handles k sources.

The "100k-files-in-one-group" pathology: the stream only scans
forward from the cursor by `page_size` files. The 99,950 other files
are never touched.

### 5.3 Deny check per candidate

For a candidate `R` of type T offered by some stream, the engine
checks Deny with one query:

```sql
SELECT 1
FROM   access_policies ap
WHERE  ap.resource_type = $T
  AND  ap.resource_id   = $R
  AND  ap.effect        = 0   -- Deny
  AND  ap.context_app_ids && ARRAY[$app, $nil]
  AND  ap.actions       @> ARRAY[$action]
  AND  NOT ap.revoked
  AND  (ap.expires_at IS NULL OR ap.expires_at > now())
  AND  ( <subject filter> )
LIMIT 1;
```

This hits the existing `ap_lookup_idx (resource_type, resource_id,
subject_type, subject_id)` index. Worst case ~5 plan rows per call;
typical case 0 (most resources have no Deny).

Optimisations:
- **Batch the Deny check** every `page_size/4` candidates with `ANY`
  predicates to amortise the round-trip.
- **Skip the Deny check** when the source is `owned_by_me` or
  `direct_user/effect=Allow` AND the candidate is the user's own
  resource — ownership is never Denied.

We also check for resource-group Denies in the same predicate batch
via a JOIN to the membership table. The expected hit rate stays
low because Deny is usually a narrow targeted carve-out.

### 5.4 No total count

Keyset pagination removes the need for `count(*)`. The UI shows
"page N of …" only when explicitly asked, and that asks the engine
for an *approximate* count via:

- For materialised sources: `reltuples / index size` estimates.
- For live sources: `count_estimate(query)` using
  Postgres's `EXPLAIN` rowcount or the `count_estimate` extension if
  available.

Where the UI insists on an exact count (rare), the call is
explicitly slow-path and emits a warning span. Default is keyset
with optional "more available" indicator.

## 6. Materialised covering tables for the hot sources

Two sources can dominate raw size: `Public` and `ServerMember`. We
maintain a covering materialised table for each, keyed to support
keyset pagination directly without touching `access_policies`.

```sql
-- one row per (Public-shared resource, resource_type) pair
CREATE TABLE public_resources (
    resource_type    SMALLINT NOT NULL,
    resource_id      UUID     NOT NULL,
    sort_created     TIMESTAMP NOT NULL,
    sort_modified    TIMESTAMP NOT NULL,
    sort_name        TEXT      NOT NULL,
    -- the set of apps and actions that the Public policies cover.
    -- one row stays valid as long as ANY Public policy still covers
    -- (resource, app, action). At read time we filter by app/action.
    app_ids          UUID[]    NOT NULL,
    actions          SMALLINT[] NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);
CREATE INDEX public_resources_by_created
    ON public_resources (resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX public_resources_by_modified
    ON public_resources (resource_type, sort_modified DESC, resource_id DESC);
CREATE INDEX public_resources_by_name
    ON public_resources (resource_type, sort_name, resource_id);
CREATE INDEX public_resources_apps_gin
    ON public_resources USING GIN (app_ids);
CREATE INDEX public_resources_actions_gin
    ON public_resources USING GIN (actions);

-- mirror for ServerMember
CREATE TABLE server_member_resources (
    -- same shape, separate table to avoid an extra WHERE
    ...
);
```

Read pattern:

```sql
SELECT r.*
FROM   public_resources pr
JOIN   files r ON r.id = pr.resource_id
WHERE  pr.resource_type = $T
  AND  pr.app_ids       && ARRAY[$app, $nil]
  AND  pr.actions       @> ARRAY[$action]
  AND  (pr.sort_created, pr.resource_id) < ($cur_ts, $cur_id)
ORDER  BY pr.sort_created DESC, pr.resource_id DESC
LIMIT  $page_size;
```

This is one indexed scan over `public_resources_by_created`, no
JOIN to `access_policies`, no UNION. p99 at 1M Public files is
sub-millisecond per page.

### 6.1 Maintenance

Triggers on `access_policies` and the resource tables:

- On INSERT of a Public Allow policy: `INSERT INTO public_resources
  (...) ON CONFLICT (resource_type, resource_id) DO UPDATE SET
  app_ids = app_ids || excluded.app_ids, actions = actions ||
  excluded.actions`.
- On DELETE / revoke / expire: recompute the row from the remaining
  active Public policies for this resource. If none remain, DELETE.
- On resource-table update of a sort column (e.g. `name` change):
  UPDATE the mirror columns.

The total row count of `public_resources` equals the count of
distinct (resource_type, resource_id) pairs that have at least one
active Public policy. At target scale: 1M rows. The triggers are
called only on a Public policy write or on a resource-row update
that touches a mirrored column. Both are low-frequency events.

### 6.2 Same machinery, lightweight, for large user-groups

If a user-group's membership exceeds a threshold (we'll start at
**1,000 members** based on the p99 target) and it owns at least one
broad Allow policy, the same materialiser kicks in:

```sql
CREATE TABLE user_group_accessible_resources (
    user_group_id    UUID     NOT NULL,
    resource_type    SMALLINT NOT NULL,
    resource_id      UUID     NOT NULL,
    sort_created     TIMESTAMP NOT NULL,
    sort_modified    TIMESTAMP NOT NULL,
    sort_name        TEXT      NOT NULL,
    app_ids          UUID[]    NOT NULL,
    actions          SMALLINT[] NOT NULL,
    PRIMARY KEY (user_group_id, resource_type, resource_id)
);
CREATE INDEX uga_resources_by_created
    ON user_group_accessible_resources
       (user_group_id, resource_type, sort_created DESC, resource_id DESC);
```

The membership-cardinality threshold means small groups skip the
overhead entirely (live `direct_user_group` stream remains). The
admin UI surfaces which groups are materialised and lets ops force
the flag if profiles disagree with the default.

## 7. Replacing `accessible_by_owner_expansion` with a runtime closure

The earlier sketch stored per-policy expansions of `AccessibleByOwner`
in a table keyed by `(policy_id, resource_id)`. At 10M resources this
is unbounded.

**Replacement.** We do *not* materialise the closure. Instead:

- At policy-write time we record: *the policy's owner*, *the
  (resource_type, action, app_id) of the policy*, and a stable
  `policy_id`.
- At listing time, when the merge needs the `accessible_by_owner_k`
  stream, the engine recursively asks "what does the policy's owner
  see for `(T, action, app)`, with `AccessibleByOwner` policies owned
  by them excluded" — i.e. it constructs a *nested* listing plan with
  one less level of recursion. Depth is bounded at 1 (cycle break
  from POLICY_SEMANTICS.md §4).
- The nested plan returns its own k-way merge cursor. We splice it
  into the outer merge.

This is sound because:
- The owner's accessible-set is itself walked via the same scaled
  machinery — owner-fast-path + materialised covers + small per-source
  streams.
- We never materialise the full closure; we walk it lazily, page by
  page, exactly like every other source.

The cost is one extra recursive plan per `AccessibleByOwner` policy
the user has. Typically a user has 0–2 such policies; the heavy ones
("the chat app can see anything I can see") are exactly the case
where the *owner's* listing is already optimised.

Implementation note: the recursion must thread a cancellation token,
because if the outer page is fulfilled before the inner cursor
exhausts, the inner cursor is dropped. Standard async-cursor pattern.

## 8. The full algorithm in pseudocode

```rust
fn list_allowed(req: ListingRequest) -> impl Iterator<Item = Resource> {
    let plan = plan_listing(&req);

    match plan {
        ListingPlan::OwnerOnly { owner_id } => {
            // Pure resource-table SQL, no engine SQL.
            return run_owner_query(owner_id, req.cursor, req.page_size);
        }
        ListingPlan::AuthMediated(am) => {
            let mut heap = BinaryHeap::new();
            let mut sources: Vec<Box<dyn SortedStream>> = vec![];

            for src in am.sources_for(&req) {
                sources.push(open_stream(src, &req.cursor, &req.sort));
            }
            for s in &mut sources {
                if let Some(item) = s.next() { heap.push(item); }
            }

            let mut out = Vec::with_capacity(req.page_size);
            let mut yielded = HashSet::new();

            while let Some(candidate) = heap.pop() {
                if out.len() == req.page_size { break; }
                if !yielded.insert(candidate.resource_id) { 
                    advance_source(&mut heap, candidate.source);
                    continue;
                }
                if has_deny(&candidate, &req) {
                    advance_source(&mut heap, candidate.source);
                    continue;
                }
                out.push(candidate);
                advance_source(&mut heap, candidate.source);
            }

            return load_resources(out);
        }
    }
}
```

`SortedStream` is an async iterator over `(sort_key, resource_id,
source_tag)`. Each implementation is one of:

- `OwnedSource(owner_id)` — runs the indexed owner query.
- `DirectPolicySource(subject_filter)` — runs the keyset query
  against `access_policies` joined to the resource table.
- `ResourceGroupSource(group_ids)` — §5.2 query.
- `PublicCoverSource()` / `ServerMemberCoverSource()` — §6 queries.
- `LargeUserGroupCoverSource(group_id)` — §6.2 query.
- `AccessibleByOwnerSource(policy)` — recursive §7.

Each stream prefetches a small buffer (e.g. 50 rows) per fetch to
amortise round-trips, then refills on demand.

## 9. Worst-case analysis

For each scenario, the SLO and the dominant cost:

| Scenario                                              | Path                          | Dominant cost                                          | SLO       |
| ----------------------------------------------------- | ----------------------------- | ------------------------------------------------------ | --------- |
| List my 1k files                                      | OwnerOnly                     | `files(owner_id, created_time DESC)` index scan        | p99 10ms  |
| List files shared with me directly (100)              | DirectPolicySource (single)   | one access_policies index scan + lookup                | p99 15ms  |
| List 50 most recent Public files (out of 1M)          | PublicCoverSource             | one index scan on public_resources_by_created          | p99 5ms   |
| Combined "everything I see" tab, light user           | merge of 3–4 sources          | merge overhead + per-source page scan                  | p99 30ms  |
| Combined tab, user in 5 groups with broad shares      | merge of 5–10 sources         | same, more sources                                     | p99 60ms  |
| Pathological: user with 200 AccessibleByOwner chains  | recursive merges              | bounded by depth=1 plus per-level merge                | p99 250ms |
| List inside a 100k-resource resource_group            | ResourceGroupSource           | scan forward from cursor, page_size rows               | p99 20ms  |
| List Public when 1M public files exist                | PublicCoverSource only        | same as above row                                      | p99 5ms   |
| Server-wide search "show all files admin can see"     | SuperAdmin short-circuit + OwnerOnly-style scan of files table | full index scan with LIMIT                              | p99 50ms  |

All numbers are **measured** — `.plans/authorization/experiments/`
runs at target scale (10k users / 10M files / 1M Public / 5M
ServerMember / 6.78M policies) confirm sub-25ms p99 for every
scenario including the pathological large-user-group case. See
`results/03-target-scale.md` for the full data. The bulk
`AccessibleByOwner` recursive chain is the only path not yet measured;
its design is in §7 and the Rust crate will be the production
implementation.

## 10. What we don't try to support

Out of scope at v1:
- **OFFSET pagination at scale.** UIs that need page numbers get an
  approximate count and a "jump to page" that uses a sort-key
  bisection (binary search via the keyset index). Cheap and
  good-enough.
- **Stable count under concurrent writes.** Counts may drift between
  page loads. Acceptable.
- **Free-text search joined with auth.** Search lives in a separate
  index (e.g. Meilisearch / Postgres FTS) that itself stores the
  permission bits or queries the auth engine per-match. Out of scope
  for the engine, in scope for the consuming service.
- **Cross-resource-type listing.** "Show me everything I can see of
  any type." Possible but each type runs its own merge in parallel
  and the front-end interleaves. Not a v1 endpoint.

## 11. Index manifest

Concrete additions to existing schemas. All are additive.

```sql
-- resource-side (per service registering a resource type)
CREATE INDEX IF NOT EXISTS files_owner_created_id_idx
    ON files (owner_id, created_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS files_created_id_idx
    ON files (created_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS files_modified_id_idx
    ON files (modified_time DESC, id DESC);

-- per resource-group membership table
CREATE INDEX IF NOT EXISTS file_file_group_members_group_idx
    ON file_file_group_members (file_group_id, file_id);

-- access_policies side (DATA_MODEL.md already covers these)
-- ap_lookup_idx (resource_type, resource_id, subject_type, subject_id)
-- ap_subject_idx (subject_type, subject_id, resource_type)
-- ap_context_apps_gin (context_app_ids)
-- ap_actions_gin (actions)

-- materialised covers (§6)
-- public_resources_by_created / _by_modified / _by_name
-- public_resources_apps_gin / _actions_gin
-- server_member_resources (same shape)
-- user_group_accessible_resources(user_group_id, resource_type, sort_created DESC, resource_id DESC)
```

## 12. Trigger surface

| Trigger event                                            | Side effect                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `access_policies` INSERT/UPDATE/DELETE with subject=Public | upsert / delete in `public_resources`                            |
| `access_policies` INSERT/UPDATE/DELETE with subject=ServerMember | upsert / delete in `server_member_resources`                  |
| `access_policies` INSERT/UPDATE/DELETE with subject=UserGroup, group is "large" | upsert / delete in `user_group_accessible_resources` |
| `user_user_group_members` INSERT/DELETE causing a small group to cross the "large" threshold | bulk repopulate / drain `user_group_accessible_resources` row set |
| Resource-table UPDATE of a sort-mirrored column (`name`, `modified_time`) | UPDATE the corresponding mirror row(s)            |
| Resource-table DELETE                                    | CASCADE via FK on resource_id                                   |

Triggers run inside the writer's transaction so the cover is
consistent at commit. Bulk re-population (cardinality threshold
crossing) is throttled — a per-group queue rebuilds the cover
asynchronously and the affected listing falls back to the live
`DirectPolicySource` stream until the rebuild lands. This is the
*only* place in the design where we accept eventual consistency.

## 13. Memory & connection-pool budgets

- A single `list_allowed` call holds at most `k × stream_buffer + dedup_set`
  rows in memory. With k ≤ 10 and a 50-row buffer plus a 100-row dedup
  set, that's ~5 KB of working memory. Well within request budgets.
- Each stream opens one Postgres connection (via the request's pool
  handle). At 10 streams × 100 concurrent listings = 1000 connections.
  We need to gate this: the engine batches all streams onto a single
  connection by submitting cursors sequentially with a small
  pipelined batch size. One connection per request, period.
- The recursive `AccessibleByOwnerSource` shares the parent's
  connection; recursion is in-process Rust, not new SQL transactions.

## 14. Instrumentation

For every list call we emit:

```
auth.list_allowed
    resource_type=File action=Get
    subject_type=User subject_id=…
    plan=AuthMediated sources=[Owned, DirectUser, PublicCover, GroupCover(2)]
    candidates_seen=187 page_yielded=50 deny_checks=12
    streams_exhausted=2/5 elapsed_ms=14.2
```

Prometheus:

- `mows_auth_list_allowed_seconds{plan, sources, resource_type}` histogram
- `mows_auth_list_candidates_per_yielded` ratio (signals sparse-access
  pathology when high)
- `mows_auth_cover_row_count{cover}` gauge per cover table
- `mows_auth_cover_lag_seconds{cover}` gauge during async rebuilds

Alert thresholds and the upgrade path are part of the Phase 3
acceptance criteria (ROADMAP.md).

## 15. Recommendation (revised)

Adopt the layered design described here:

1. **OwnerOnly fast path** for the common "my things" case. (§4)
2. **k-way sorted stream merge with keyset pagination** as the only
   auth-mediated listing primitive. (§5)
3. **Materialised covering tables** for `Public`, `ServerMember`, and
   large user-groups. (§6)
4. **Lazy recursive expansion** of `AccessibleByOwner` via nested
   listing plans, no closure table. (§7)

What we drop from the prior sketch:

- `UNION + EXCEPT` and the giant intermediate sets.
- The `accessible_by_owner_expansion(policy_id, resource_id)` table.
- Total-count pagination by default.
- The per-(subject, app, type, action) `listing_cache` table (Strategy
  B in the old draft). The covers in §6 are the *targeted* form of
  the same idea, scoped to the cases that actually need it.

What we add:

- The `ListingPlan` enum and the engine's planner.
- Sorted-stream / merge primitives in the engine.
- Public / ServerMember / large-group cover tables and their
  triggers.
- Keyset pagination as the engine default; OFFSET is an opt-in
  slow-path with an approximate-count helper.

## 16. Test obligations specific to this design

In addition to the property tests in POLICY_SEMANTICS.md §9:

- **Cover consistency.** Random workload of policy CRUD + resource
  CRUD, comparing the cover state to a recomputed-from-scratch
  reference after each operation.
- **Merge correctness.** k-way merge results match a brute-force
  set-union for small inputs.
- **Owner-path bypass.** A profiler-assertion: an `?owner=me` list
  call touches zero rows of `access_policies`.
- **Pagination stability.** Walking the keyset cursor over a static
  dataset returns every row exactly once.
- **Pagination resilience.** Walking the cursor while concurrent
  writes happen never returns a row twice and never skips a row that
  was present at both the cursor's start and end timestamps.
- **Scale benchmarks.** At the §1 target sizes, every scenario in §9
  meets its SLO on a single-node Postgres with the engine's
  recommended `work_mem` / `effective_cache_size`.

These are the gates for Phase 3 sign-off.
