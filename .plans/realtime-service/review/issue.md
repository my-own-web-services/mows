# Multi-review — Phase 6 + Phase 7 chat-server

6-perspective review (Security, Tech, Architect, QA, Fine Taste,
Slop) of the chat-server crate + design docs + Phase 7 demo.
Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

Diff coverage: commits `fd144e1c` (Round 1) + `e501b34e` (Round 2)
+ all uncommitted Round-3/4/5/6/7 working-tree changes
(~2546 insertions across 33 files).

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 2        | 2     | 2     |
| Tech        | 0        | 3     | 5     |
| Architect   | 0        | 5     | 3     |
| QA          | 2        | 5     | 3     |
| Fine taste  | 0        | 2     | 7     |
| Slop        | 3        | 5     | 3     |

After dedup: **17 actionable** items, **12 deferred / not-real**.

## Actionable

- **A1 (Critical)** ✅ — `?user=<uuid>` query fallback in the auth
  middleware is gated by `config.enable_dev` evaluated **at request
  time**. A config drift to `enable_dev=true` in production opens
  full auth bypass. (SLOP-2, TASTE-7)
  **Fix:** Add a dedicated `enable_dev_user_query_auth` flag
  that's off-by-default and not derivable from `enable_dev`;
  refuse to enable it at boot if `LISTEN_PORT` binds anything but
  `127.0.0.1` AND log a warning each time the bypass is used.

- **A2 (Critical)** ✅ — `POST /api/access_policies/create` lets
  any authenticated user create policies on resources they don't
  own. (SECURITY-1, ARCH-5)
  **Fix:** Gate the handler with a per-resource ownership check —
  require the caller to own (`resource_id` belongs to caller's
  channels) OR have `AccessPoliciesCreate` granted on the
  resource. Type-level `AccessPoliciesCreate` is the default-
  permissive surface for system-initiated bootstraps.

- **A3 (Critical)** ✅ — `ChatError::AuthEvaluationAccessDenied(AuthResult)`
  serialises the full `AuthResult` (subject ids, policy ids,
  reason codes) into the HTTP response body. Info leak. (SLOP-4)
  **Fix:** Generic "access denied" message client-side; log the
  full `AuthResult` server-side via `tracing::warn!`. Mirror
  filez's pattern.

- **A4 (Critical)** ✅ — `tests/end_to_end.rs:151` uses a
  hardcoded `sleep(50ms)` to race-window the WS subscription
  before publishing. Flaky on slow CI; masks a real
  synchronization concern. (SLOP-3, QA-1)
  **Fix:** Drop the sleep by reading the WS welcome frame (or
  installing a `tokio::sync::Notify`) before the publisher fires.

- **A5 (Critical)** ✅ — `tests/end_to_end.rs::reset_schema` runs
  `DROP SCHEMA public CASCADE` against `CHAT_TEST_DB_URL` with no
  safety check. A misconfigured CI / dev env that points
  `CHAT_TEST_DB_URL` at a real DB silently destroys it. (QA-2)
  **Fix:** Hard-fail the test if `current_database()` does not
  contain `"test"` OR the URL does not point at localhost.

- **A6 (Critical)** ✅ — `config()::expect("failed to load …")`
  panics on env-var parse failure without a clean exit code. The
  panic is a SIGABRT with no log, indistinguishable from a process
  crash. (SLOP-1)
  **Fix:** Propagate the error from `from_env()` up through
  `main()`'s `anyhow::Result`; the runtime prints + exits 1 cleanly.

- **A7 (Major)** ✅ — `state.rs::bootstrap_chat_app` is non-
  atomic: SELECT then INSERT. Two instances starting against the
  same DB race on the second INSERT → UNIQUE violation panic.
  (SLOP-7)
  **Fix:** `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *` plus
  a follow-up SELECT for the conflict-skipped path. Idempotent
  and race-safe.

- **A8 (Major)** ✅ — Three `expect()` calls in
  `models/access_policies/store.rs` on `from_u32` lookups panic
  on unknown resource_type / action. A future migration that
  inserts a row with an unknown discriminant crashes the auth
  hot-path. (SLOP-6, TECH-1, TECH-2, TASTE-1)
  **Fix:** Replace `.expect(...)` with `.ok_or_else(|| AuthError::Evaluation(...))?`.

- **A9 (Major)** ✅ — WS handler silently drops events when
  `serde_json::to_string` fails (`continue`). Subscribers see no
  message + no indication. (SLOP-5)
  **Fix:** On serialize failure, log + send a `Lagged { dropped: 1 }`
  frame so the client re-fetches.

- **A10 (Major)** ✅ — `channels/delete.rs` does two non-atomic
  DELETEs (channel + access_policies). If the second fails the
  channel is gone but policies linger. (QA-5)
  **Fix:** Wrap both in `connection.transaction()` so they commit
  together or roll back together.

- **A11 (Major)** ✅ — Wire-stability tests for
  `AccessPolicyResourceType` (0–3) and `AccessPolicyAction`
  (100–240) discriminants are missing. A renumber silently
  corrupts every stored policy. (QA-3)
  **Fix:** Add tests asserting `Variant as i16 == <expected>` for
  every variant. Mirror filez's wire-stability guard pattern.

- **A12 (Major)** ✅ — `ChatPolicyStore::list_visible_resource_ids`
  applies the lifecycle filter but no test proves a revoked /
  expired policy is correctly filtered out. (QA-4)
  **Fix:** Extend `end_to_end.rs` with a revocation step that
  asserts a revoked policy stops granting access.

- **A13 (Major)** ✅ — `models/users/mod.rs` exports `FilezUser` +
  `FilezUserId` — filez naming in chat code. Misleads readers
  about provenance + ownership. (ARCH-1)
  **Fix:** Rename to `ChatUser` + `ChatUserId` throughout the
  crate.

- **A14 (Major)** ✅ — `.plans/chat-service/ARCHITECTURE.md:68`
  references `FilezError::AuthDenied` (copy-paste from filez).
  Doc drift. (ARCH-2)
  **Fix:** Replace with `ChatError::AuthEvaluationAccessDenied`.

- **A15 (Minor)** ✅ — `AuthenticationInformation.context_app` is
  populated from `AppState.chat_app`. Two names for the same
  concept. (TASTE-4)
  **Fix:** Rename `AppState.chat_app` → `AppState.context_app` so
  the storage and consumption names match.

- **A16 (Minor)** ✅ — `bootstrap_chat_app`'s `trusted: true`
  hardcode has no comment explaining the in-prod meaning.
  Future readers wiring a real app row need the rationale.
  (ARCH-7)
  **Fix:** Add a comment above `trusted: true` explaining the
  single-app constraint + the path to untrusted-app support.

- **A17 (Minor)** ✅ — Demo serves at `/demo/` via ServeDir.
  ServeDir is path-traversal-safe by default, but a quick
  comment + a smoke assertion (in the SQL test suite or
  end_to_end) anchors the assumption. (SLOP-8)
  **Fix:** Inline comment + a test fetch of `/demo/../etc/passwd`
  asserting 404.

## Deferred

- **D1** ⁉️ — Mutex contention in `ChannelBroadcastRegistry`
  (TECH-4). MVP single-process is explicit; DashMap is a v2
  optimization.

- **D2** ⁉️ — `groups.clone()` allocation per direct-policy
  fetch (TECH-5). Hot-path is User-only in chat MVP where
  `groups` is `vec![]`; cost is zero today. Fix when user_groups
  schema lands (Round 4).

- **D3** ⁉️ — Two connections per `list_visible_resource_ids`
  call (TECH-6). Trade-off acceptable for MVP; refactor when the
  EngineBackedPolicyStore extraction lands.

- **D4** ⁉️ — SQL block duplication across
  `fetch_direct_policies` / `fetch_type_level_policies` /
  `list_visible_resource_ids` (SLOP-11). Genuine duplication; the
  fix is the same `EngineBackedPolicyStore` extraction that
  motivated the duplication finding in IDEA.md. Track there.

- **D5** ⁉️ — Per-user/per-channel rate limiting on message
  send (SECURITY-5). Real concern but out of scope for engine
  validation; explicit deferred item.

- **D6** ⁉️ — Negative-path coverage in `end_to_end.rs`
  (QA-8). The browser-driven flow already exercises the deny
  path; reinforcement test is nice-to-have, not a blocker.

- **D7** ⁉️ — `RUST_LOG` parse-error silent fallback (SLOP-10).
  Mirrors filez; ergonomics nit not a bug.

- **D8** ⁉️ — `fake_message()` builder pattern (TASTE-8).
  Low-signal nit.

- **D9** ⁉️ — `maybe_` prefix on Option params (TASTE-3).
  Filez uses the same convention; staying consistent across
  consumers wins over local idiom.

## Not-real findings

- **SECURITY-4** ⁉️ — Claims `format!()` splice in `fetch_owners`
  is unsafe. Verified: `mows_auth_core::StaticResourceTypeRegistry`
  validates every identifier via `SAFE_IDENTIFIER_REGEX` at
  registry-build time AND panics on failure
  (`mows-auth-core/src/registry.rs`). Adding a local recheck is
  cargo-cult.

- **SECURITY-6** ⁉️ — Claims demo UI should pre-check ownership
  before showing the share button. UX nit, not a security issue;
  the backend correctly denies.

- **SECURITY-2** ⁉️ — Claims a malformed `X-Chat-User-Id` should
  return 401 not 400. Malformed input IS a bad request, not an
  auth failure. Reject the rename.

- **TECH-3** ⁉️ — Claims `lifecycle_filter()` raw SQL is brittle.
  Filez (the canonical implementation) uses the exact same raw
  SQL pattern for the same reason — `Nullable<Bool>` doesn't
  unify with `Bool` in the DSL. Parity wins.

- **TECH-7** ⁉️ — Claims stringly-typed `AuthError::Evaluation`
  is bad. Owned by mows-auth-core; out of scope for chat.

- **TECH-8** ⁉️ — Claims `(id, _)` tuple destructure is unclear.
  Comment already explains.

- **TASTE-2** ⁉️ — Claims `Box<dyn BoxableExpression>` return is
  opaque. Standard diesel pattern; filez uses the same shape.

- **ARCH-3** ⁉️ — Restates the "extract `EngineBackedPolicyStore`
  now" suggestion. Tracked in IDEA.md as the explicit Phase-6
  decision (extract when a third consumer arrives). Reject the
  push-forward.

- **ARCH-4** ⁉️ — Claims `"owner-list: {e}"` log prefix is a typo.
  It's not — the inline SQL string IS for the owner-list pass.
  Renaming to `list_visible_owner` is a minor consistency tweak
  fold into TASTE-4's rename pass.

- **ARCH-8** ⁉️ — Claims PLAN.md should mention user_groups
  migration isn't shipped. Already covered explicitly in
  `.plans/chat-service/PLAN.md` Round-4 section.

- **SLOP-9** ⁉️ — Claims dev/seed needs a reset endpoint. Out of
  scope for engine validation; `DROP SCHEMA` covers it.

- **SLOP-10** ⁉️ — Same as TECH/SLOP overlap; covered by D7.

## Action plan

All 17 actionable items resolved in this round. Final state:

| Item | Status | Verified by |
| ---- | ------ | ----------- |
| A1   | ✅     | new `enable_dev_user_query_auth` flag in config.rs + main.rs refuses to boot on non-localhost with the flag on |
| A2   | ✅     | policies/create.rs requires caller to own the targeted Channel; type-level Channel policies refused |
| A3   | ✅     | `AccessEvaluationAccessDenied` Display now just "access denied"; full AuthResult logged server-side via tracing::warn! |
| A4   | ✅     | new `ChannelEvent::Ready` handshake frame replaces the 50ms sleep; test waits for it |
| A5   | ✅     | `reset_schema` guards via host=localhost AND db-name contains test/chat |
| A6   | ✅     | `init_config()` called by main()'s `?` chain; OnceLock fallback only fires on programmer error |
| A7   | ✅     | bootstrap_chat_app uses `INSERT ... ON CONFLICT DO NOTHING` + idempotent SELECT |
| A8   | ✅     | every expect() on registry/action lookup → `?` on `AuthError::Evaluation(...)` |
| A9   | ✅   | WS serde failure → log + emit `ChannelEvent::Lagged{1}` so subscriber knows to re-fetch |
| A10  | ✅     | channels/delete wraps both DELETEs in `connection.transaction(\|conn\| ...)` |
| A11  | ✅     | new `wire_stability_guard` mod pins every discriminant (3 tests, 16 assertions) |
| A12  | ✅     | end_to_end.rs revokes the policy via DELETE /access_policies/delete + asserts Bob re-denied |
| A13  | ✅     | sed rename `FilezUser` → `ChatUser` + `FilezUserId` → `ChatUserId` across the crate |
| A14  | ✅     | ARCHITECTURE.md §"REST handler" now references `ChatError::AuthEvaluationAccessDenied` |
| A15  | ✅     | `AppState.chat_app` → `AppState.context_app`; `bootstrap_chat_app` fn name kept (descriptive) |
| A16  | ✅     | state.rs has multi-line comment above `trusted: true` explaining the single-app constraint |
| A17  | ✅     | comment + new `tests/end_to_end.rs::demo_path_traversal_404` step asserts ServeDir rejects `..` |

Test totals after fixes:
- mows-auth-core: 118 tests ✅
- chat-server lib: 9 tests ✅ (+3 wire-stability)
- chat-server integration: 1 end-to-end test ✅ (revoke + path-traversal smoke woven in)
- filez-server: 57 tests ✅ (cross-crate sanity)
