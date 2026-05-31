# Phase 7 audit-log — multi-review round 1

Date: 2026-05-31
Scope: realtime audit_log table + writer + reader (migration 3,
`models/audit_log/`, `http_api/audit_log/list.rs`), filez sibling
endpoint, 5 realtime write-site instrumentations
(channels/create/update/delete + policies/create/delete), the
`#[schema(value_type = Object)]` annotation on filez's existing
audit_log model, authz-admin BFF forwarder, SPA AuditLogPanel +
unwrapper.

Reviewers: 3 parallel `Explore` agents (Security, Tech+QA, Slop).
Security came back clean (no exploitable findings); Tech+QA and Slop
found 13 actionable items.

## Findings — dispositions

Severity legend: ▲ Critical · ◆ Major · ○ Minor

### R1 — `format!("{:?}", enum)` for wire-stable audit strings (TECH-1 / SLOP-1) ▲

`policies/create.rs` and `policies/delete.rs` use Debug formatting
to render `subject_type` and `action` ids into the audit row's
`metadata` blob. Debug output isn't wire-stable — a future derive
change or variant reorder silently changes the JSONB column,
breaking every reader that filters or renders by name.

**Disposition:** FIX. Add stable `as_audit_string()` helpers on
`SubjectType` (already in `mows_auth_core::types`) and
`AccessPolicyAction` (realtime-local enum); pin via tests. Replace
the `{:?}` formats with the helper calls. The audit-event
metadata-shape tests cover the read side; the helper tests cover
the write side.

### R2 — Channel-name fetch outside the delete transaction (SLOP-5) ▲

`channels/delete.rs` fetches the channel's name before opening the
delete transaction, captures it for the audit row, then deletes
inside the transaction. A concurrent transfer / delete between the
fetch and the transaction would let the audit row carry a stale
name — or worse, fetch a name that no longer corresponds to the
deleted row.

**Disposition:** FIX. Move the name capture into the same
transaction as the delete by using Postgres `RETURNING` on the
DELETE — single round-trip, atomic, no race window.

### R3 — Missing non-owner 403 BFF test (QA-1) ◆

The 5 new BFF integration tests cover identity passthrough, anon-
401, unknown-upstream, invalid-UUID, oversize-body. They don't
exercise the upstream-403 surfacing path (the canonical "no such
resource OR not your resource" collapse). A regression in the
upstream owner gate wouldn't be caught at the BFF layer.

**Disposition:** FIX. Add
`audit_log_surfaces_upstream_403_when_caller_is_not_owner`
mirroring the existing `by_resource` 403-surfacing test.

### R4 — AccessPolicyDeleted metadata shape not pinned (QA-7) ◆

`AccessPolicyCreated`'s metadata is pinned by a wire-stability test
(`metadata_field_stability_guard`); `AccessPolicyDeleted` carries
the same field set but has no equivalent test. A future rename of
`actions` to `action_list` in just `AccessPolicyDeleted` would
silently corrupt new delete audit rows.

**Disposition:** FIX. Add the sibling test.

### R5 — Keyset filter duplicated across 4 code paths (SLOP-2 / TECH-2) ◆

The `(ts < c.ts) OR (ts == c.ts AND id < c.id)` keyset where-clause
appears twice in realtime `list.rs` (resource-scoped + self-scoped
branches) and twice in filez `list.rs`. A future cursor-format
change has to land in 4 places without divergence.

**Disposition:** FIX. Extract a local `apply_keyset_filter` helper
in each file (we don't share a crate yet — extracting to
`mows-auth-core` is the better fix but adds scope; one-file
helpers stop the within-file drift right now).

### R6 — `formatMetadata` `event_type` filter is implicit (SLOP-9) ○

`formatMetadata` drops the `event_type` key because the adjacent
column already renders it. Reader of the function can't tell why
without spotting the table column to its left.

**Disposition:** FIX. One-line comment naming the why.

### R7 — Cursor-collision infinite loop guard (QA-5 / SLOP-10) ◆

If the upstream regresses and returns the SAME `next_cursor` twice
in a row, the SPA's "Load more" appends duplicate entries on every
click and the button stays active forever — no error, no progress.

**Disposition:** FIX. Track the prior cursor in the panel; refuse
to re-issue with an identical cursor + surface a "no more
entries" message.

### R8 — `unwrapAuditLog` missing `actor_id` type guard (QA-6) ○

The unwrapper validates `id`, `event_type`, `ts` shapes but not
`actor_id`. A malformed upstream response with `actor_id: 123`
slips through and feeds garbage to the React row key + the
formatter.

**Disposition:** FIX. Add `actor_id` to the validator.

### R9 — Self-scope query filter has no unit test (QA-3) ○

The handler correctly filters by `actor_id.eq(caller.id)` in the
self-scope branch, but no test proves the filter is on the right
column. A regression that swapped to `created_id` (or removed the
filter) wouldn't be caught until production.

**Disposition:** FIX. Add a unit test that constructs an
in-memory PolicyStore-style fixture OR fall back to a wire-shape
guard that pins the SQL shape via diesel's debug-query macro.

### R10 — Empty-list null cursor test missing (QA-2) ○

When a page returns 0 entries, `next_cursor` must be `null` so the
SPA hides "Load more". No test pins this; a regression that
emitted a non-null cursor for an empty page would surface as a
phantom "Load more" button.

**Disposition:** FIX. Add a small unit test.

### R11 — Partial-scope rejection not BFF-tested (QA-4) ○

The upstream rejects `resource_type` without `resource_id` (and
vice versa) with a 400. The BFF forwards the request, the
upstream 400 surfaces via `upstream_status` — but no test pins
this path.

**Disposition:** FIX. Add a BFF integration test.

### R12 — Brittle deep-path assertions in BFF tests (SLOP-12) ○

`body["data"]["upstream_body"]["data"]["entries"][0]["event_type"]`
is a 5-level deep walk. An envelope-shape change anywhere along
the path becomes an opaque index-out-of-bounds.

**Disposition:** ACCEPT. The shape IS the wire contract; pinning
it via a deep path is intentional. The wire_shape_guard tests on
both sides catch envelope renames at unit-test time. Better
failure messages would be nice but the duplication of "first
extract then assert" boilerplate is worse.

### R13 — `#[schema(value_type = Object)]` comment too terse (SLOP-7) ○

The annotation is there for utoipa/swagger-rs interop; the current
comment names the technical reason but not the consequence
(clients lose autocomplete on `metadata` field names).

**Disposition:** FIX. Expand the comment in both sibling files.

### R14 — Stable enum-string helpers also pin `actions` rendering (TECH-5) — covered by R1

TECH-5 flagged that storing `subject_type` / `actions` as `String`
forfeits type safety. The forward-compat rationale stands; the
fix is the stable-string mapping from R1. Once that lands the
storage layer is safe-by-construction.

**Disposition:** Covered by R1; no separate work.

### Deferred / acknowledged

- **R-D1 (SLOP-6 / TECH-3 / ARCH-1)**: Audit writes run outside
  the operation transaction — a partially-failed audit leaves the
  operation committed without an audit row. The current design is
  deliberate (audit failure surfaces a 500 to the caller so the
  broken pipeline is visible), but the reviewer is right that
  refactoring the writes into a shared transaction is cleaner.
  This is a larger refactor that needs `AuditLog::insert` to
  accept a `&mut AsyncPgConnection` instead of `&Database`,
  threaded through all 5 write sites + filez. Tracked for a
  follow-up commit; current state documented more explicitly per
  the slop note.
- **R-D2 (SLOP-3)**: `MAX_LIMIT` (200) + `DEFAULT_LIMIT` (50)
  hardcoded twice. A shared crate is the right home; defer until
  `mows-auth-core` (or a new `mows-audit-log-common`) absorbs the
  shared bits.
- **R-D3 (SLOP-4)**: `with_timing!` is a filez-specific macro
  (depends on filez's server-timing middleware). Realtime doesn't
  carry the middleware; adding it for one endpoint isn't worth it.
  Tracked as Phase 7 follow-up if realtime adopts the middleware.
- **R-D4 (SLOP-8)**: Stringly-typed cursor format. Inspectable for
  operator debugging; the parser is strict, the format pins via
  test. Accept.
- **R-D5 (TECH-4)**: `into_boxed()` allocation overhead per query.
  Negligible.
- **R-D6 (SLOP-11)**: Client-side `partialScope` validation
  duplicates the upstream's. Defense-in-depth; accept with comment.
- **R-D7 (SLOP-13)**: Filez's pre-existing `use UserGroupId as _;`
  shim — not my code, out of scope for this review.

## Implementation order

R1 (audit-string helpers) → R5 (keyset helper) → R2 (delete
RETURNING) → R6/R13 (comments) → R7/R8 (SPA hardening) → tests
R3/R4/R9/R10/R11.
