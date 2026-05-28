# Phase 3 Final Multi-Review

4-perspective review (Security, Tech, QA, Slop) of the Phase-3
listing-engine completion batch — P3-6 (ViaResourceGroupStream),
P3-7 (AccessibleByOwnerStream stub), P3-8 (list_visible_paginated
planner + filez cutover).

Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 0        | 2     | 1     |
| Technology  | 2        | 2     | 7     |
| QA          | 2        | 5     | 3     |
| Slop        | 1        | 3     | 6     |

After dedup: **3 critical actionable**, **8 major actionable**, rest
minor / deferred.

## Actionable

- **A1** ❌ — `fetch_accessible_resource_group_ids` (filez) builds
  THREE SQL templates with two `let _ = sql;` discards. The outer
  `let sql = format!(...)` (lines ~152-163) is dead — the branches
  build their own `sql_user` / `sql_anon`. Remove the dead template;
  hoist the user/anon decision so we format once. (TECH-3 + SLOP-2 +
  SLOP-9 same root.)

- **A2** ❌ — `stream_via_resource_group_resources` trait default
  fails loud, but the contract is "stores without resource-group
  semantics return empty" — not every store should be forced to
  override. (TECH-9.)
  **Fix:** default `Ok(vec![])`.

- **A3** ❌ — filez `list_paginated` exposes both `page_size` AND
  `batch_size` to the HTTP boundary. LISTING.md §5.1: `batch_size
  ~= page_size * 4`. Callers will pass wrong values. (TECH-6 +
  SLOP-4.)
  **Fix:** drop `batch_size` from the wrapper signature; derive
  internally as `page_size.saturating_mul(4).max(50)`.

- **A4** ❌ — No SuperAdmin planner test. The planner doesn't
  short-circuit for SuperAdmin (acceptable — `is_denied` early-
  returns Ok(false) so the path is correct, just slower). Pin the
  observable behaviour so a future refactor can't break it.
  (SECURITY-1 + QA-1.)

- **A5** ❌ — `planner_anonymous_only_sees_public_and_via_rg` test
  name LIES — its `PlannerStore` doesn't populate any resource-
  group data, so the via_rg stream is never exercised. (SLOP-8.)
  **Fix:** add a dedicated `planner_via_resource_group_stream_merges`
  test that actually populates `resource_group_ids` + `via_rg`;
  optionally rename the misleading one.

- **A6** ❌ — Stream-order tie-break invariant in the planner is
  undocumented. The merge dedups by `(sort_key, resource_id)` and
  "first stream wins"; the planner pushes 7 streams in a fixed
  order. A future reorder silently flips dedup winners. (SLOP-5.)
  **Fix:** comment above the stream-vec assembly explaining the
  invariant + the rationale for the chosen order.

- **A7** ❌ — `stream_owner_wrapper` is a one-line alias for
  `boxable_stream_ref` with a misleading docstring. (TECH-2 +
  SLOP-3.) **Fix:** inline.

- **A8** ❌ — `_placeholder: i64 = 0` + `let _ = _placeholder;`
  in `fetch_accessible_resource_group_ids` is dead code from the
  refactor. (TECH-4 + SLOP-10.) Falls out when A1 is fixed.

- **A9** ❌ — Future-cursor (sort_key way past every item) edge
  case untested in the planner. (QA-7.)

- **A10** ❌ — Planner stream-error propagation untested. (QA-9.)

- **A11** ❌ — OwnerOnly fast path cursor pagination untested.
  (TECH-1 + QA-4.)

## Deferred

- **D1** ⁉️ — list.rs is now ~3300 lines (TECH-8). Module split
  (list/streams.rs, list/planner.rs, list/merge.rs) is a worthwhile
  cleanup but better done as a focused refactor PR.

- **D2** ⁉️ — Move `AuditEvent` enum + audit_log table to
  mows-auth-core (recurring ARCH finding from prior review). Phase 6
  work.

- **D3** ⁉️ — Filez integration tests (QA-3 + QA-5 + QA-6 + QA-10).
  No DB test rig in the repo; tracked separately. Source-grep guards
  cover the most fragile shapes.

- **D4** ⁉️ — `AccessibleByOwnerStream` keeps unused fields for the
  future recursive impl (TECH-5). Intentional.

- **D5** ⁉️ — Defensive empty-check in filez `stream_via_resource
  _group_resources` (SLOP-7). Belt-and-braces — the engine
  short-circuits but the filez impl guards too. Costs nothing,
  catches a future engine bug.

- **D6** ⁉️ — Identifier validation `debug_assert` (SLOP-6).
  Recurring finding from the prior review; the registry validates
  at build time. The marginal `debug_assert` in every store method
  is a fair ask but a separate cleanup PR.

- **D7** ⁉️ — SuperAdmin bypass in `fetch_accessible_resource
  _group_ids` (SECURITY-3). The current shape (SuperAdmin runs the
  same filter as everyone else) is documented behaviour; carving
  out a per-method SuperAdmin short-circuit can land with the
  broader "SuperAdmin shortcuts" follow-up.

- **D8** ⁉️ — Add test that `AccessibleByOwnerStream` stub yields
  empty (QA-8). Covered indirectly — the planner tests don't
  populate ABO data, and the stream impl is 1 line. The test would
  pin behaviour useful at the moment recursion lands.

- **D9** ⁉️ — `batch_size = 0` is debug_assert-only in release
  (QA-2). Same caller-bug shape as the rest of the API; documented.

- **D10** ⁉️ — Wrapper resolves `is_super_admin: false`
  unconditionally (QA-3). Filez today has no SuperAdmin
  signalling at the HTTP boundary; wiring it through is a separate
  feature.
