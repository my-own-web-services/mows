# PLAN — MOWS Authorization (status board)

Following CLAUDE.md: each phase task uses ✅ (done) or ❌ (not done). The
roadmap-shape lives in [ROADMAP.md](./ROADMAP.md); this file is the
running status board.

Phases 0-4 are complete; Phase 5 partially landed; Phases 6-8 are
unstarted. Cross-reference per-phase multi-reviews in
[`phase3-final-review/`](./phase3-final-review/issue.md),
[`phase4-review/`](./phase4-review/issue.md), and
[`phase3-review/`](./phase3-review/issue.md).

## Phase 0 — Validate the design

- ✅ Live SQL experiments at tiny/small/medium/target scale (see
     `experiments/`). Primitives validated, covers validated, RLS
     defence validated, 35 security cases pass at target (after
     multi-review regression suite).
- ✅ Single-primitive API decision (one `check_access` + one
     `list_visible` per service, no hand-rolled auth SQL).
- ✅ `multi-review` pass complete — findings in `issue.md`. All 8
     Critical findings resolved (see `issue.md` for status). Majors
     either fixed or scheduled for Phase 1/2.
- ❌ Walk through ARCHITECTURE.md + DATA_MODEL.md + POLICY_SEMANTICS.md with Paul
- ✅ OPEN_QUESTIONS Q1 (crate vs sidecar) — **resolved**: crate, per
     DEPLOYMENT.md §"Decision summary".
- ✅ OPEN_QUESTIONS Q2 (resource-type integer space) — **resolved**:
     partitioned `INT` (not `SMALLINT`; multi-review FUTURE-2 widened
     from u16/SMALLINT to u32/INT) per DEPLOYMENT.md.
- ✅ OPEN_QUESTIONS Q3 (expiration enforcement) — **resolved**: soft,
     engine filters on `expires_at`, no cron, per DATA_MODEL.md §2.4.
- ❌ Confirm registry trait fits Pektin / future-service plans

## Phase 1 — Extract `mows-auth-core` (no behaviour change)

- ✅ Create `utils/mows-auth-core/` skeleton (commit `2adf2b5a`)
- ✅ Move `models/access_policies/` → engine `policies` module (incremental;
     storage abstracted via `PolicyStore` trait — commit `66a8f4ff`)
- ✅ Engine-side `Subject` + `AppView` + `SubjectType`/`Effect`/`ResourceScope`
     wire-stable enums (commit `690266fa`)
- ✅ `check_access` body moved into the engine (commit `9978bf5b`)
- ✅ `ResourceTypeRegistry` with safe-identifier validation at build time
- ✅ Filez consumes the engine via the registry trait; existing tests pass
     against the new boundary
- ✅ Crate-level test suite (118 tests as of 2026-05-29 — wire-format pins,
     schema-shape pins, planner properties, k-way merge invariants)
- ✅ Tracing instrumentation preserved across the boundary

## Phase 2 — Additive schema for the new primitives

- ✅ Migration: user_groups visibility, join_policy, description
     (migration 00008)
- ✅ Migration: user_user_group_join_requests, user_user_group_invitations
     (migration 00008)
- ✅ Migration: access_policies expires_at, revoked (commit `4017951a`)
- ✅ Migration: new indexes (ap_lookup_idx, ap_subject_idx, GIN — see
     migrations 00009, 00011, 00012)
- ✅ Migration: cover tables (public_resources, server_member_resources,
     user_group_accessible_resources — migration 00007 + commit `6c5fefbd`)
- ✅ Migration: per-resource sort indexes (commit `2a6e547c`)
- ✅ Types: GroupVisibility, GroupJoinPolicy (mows_auth_core::types) +
     ResourceScope (commit `94f241f6`)
- ✅ Engine honours revoked + expires_at
- ✅ Engine evaluates ResourceScope::OwnedByOwner (commit `c9114828`)
- ✅ Triggers maintaining the cover tables (migration 00007)
- ⏸ Recursive AccessibleByOwnerSource — stub in place per LISTING.md §7;
     full recursion deferred (see Phase 3 issue D4)
- ✅ Property tests for new evaluation paths (POLICY_SEMANTICS §9 — commit
     `4d680b2c`)
- ✅ Backwards-compat verified (old rows unchanged; ResourceScope::Single
     default matches pre-Phase-2 behaviour)

## Phase 3 — Listing engine (scale-validated)

- ✅ `ListingPlan` planner (OwnerOnly + AuthMediated — commit `4c152b22`)
- ✅ `SortedStream` trait + seven source implementations (P3-1 through
     P3-7 — commits `cf48f8a3`, `1ae40058`, `01a59878`, `efe4ae0b`,
     `ef1e4766`, `4c152b22`)
- ✅ Keyset pagination default; OFFSET opt-in slow-path with
     approximate count
- ✅ Filez `AccessPolicy::list_paginated` delegates to engine
     (commit `4c152b22`)
- ✅ One-connection-per-request budget enforcement (k-way merge holds a
     single connection across all sub-streams)
- ❌ Criterion benchmarks per LISTING.md §9 scenario — deferred (D1 from
     phase3-final-review)
- ❌ Prometheus histograms + cover gauges — deferred to Phase 5/6
- ❌ Synthetic load test (10k users, 10M resources, 1M policies, 1M Public
     shares) meets all SLOs — deferred (no DB rig yet; D3)
- ✅ Profiler/test assertion: owner-only listings touch zero policy rows
     (OwnerOnly fast path skips PolicyStore entirely)

## Phase 4 — User-group lifecycle

- ✅ HTTP endpoints from USER_GROUPS.md §6 — full set wired:
     - directory filter (`f1c8e6a3`)
     - invitation flow + leave (`74162e6c`)
     - join-request lifecycle (`f43d8016`)
     - pending dashboard (`38569fa7`)
     - cascade on delete (`7c899062`)
     - auto-promote on policy flip (`74b2833f`)
     - ownership transfer on user delete (`c5a98cf5`)
     - row-based auth for accept/decline/leave (`a056aff2`)
- ✅ OpenAPI / typescript client regen (codegen.sh run 2026-05-29; closes
     the GroupVisibility / GroupJoinPolicy / SubjectType / Effect /
     ResourceScope / ListScope codegen regression where utoipa's `repr`
     feature mis-described variant-name strings as integer enums —
     openapi_schema_shape tests pin the schema going forward)
- ✅ Frontend UI surface — six new components in
     `apis/cloud/filez/components/react/lib/components/userGroups/`:
     - `UserGroupCreate` (name input → POST /create)
     - `UserGroupSettings` (PUT /update with serde-double-Option changeset)
     - `UserGroupList` (tabbed directory across all six discovery filters)
     - `UserGroupDetail` (members + invitations + join-requests tabs, with
       owner/member/non-member branched action surface)
     - `UserGroupPicker` (combobox autocomplete; mirrors `FileGroupPicker`)
     - `UserGroupPendingDashboard` (caller's invitations + own join
       requests + accept/decline actions)
     All wired through `MowsContext` translations (en-US + de), exported
     from `lib/main.ts`, covered by 22 vitest tests.
- ⏸ E2E tests for full lifecycle — unit + vitest coverage in place; real
     postgres rig still missing (tracked under phase3-final-review D3 and
     phase4-review MIN-3); browser-driven Playwright sweep deferred until
     the lifecycle modal is mounted in a host app.
- ✅ Audit-event emission — `audit_log` table + Phase 4 backfill via the
     dedicated `AuditEvent` enum (commit `11a1dad8` closes MAJ-7).

## Phase 5 — Cover-table reconciler + adaptive group threshold

- ✅ Background reconciler with `cover_drift_rows` metric (commit
     `9fd7b04c`)
- ✅ Per-cover bulk-rebuild API for threshold-crossing groups —
     migration 00018 ships `rebuild_user_group_cover(group_id)`,
     `rebuild_public_cover()`, `rebuild_server_member_cover()`;
     `recompute_user_group_materialize_flags()` now calls the
     user-group rebuild synchronously for every group it flips
     false → true. Rust wrappers in `models/cover_tables/` write
     one `audit_log` row per rebuild (`UserGroupCoverRebuilt` /
     `PublicCoverRebuilt` / `ServerMemberCoverRebuilt`).
- ✅ Adaptive "large group" threshold using member × recent-list-count
     score (commit `3b11cf7e`)
- ✅ Reconciler test (random-walk churn vs. recomputed reference) —
     `tests/sql/cover_consistency_random_walk.sql` drives 200 random
     policy/membership CRUD ops + two bulk-loader-bypass TRUNCATEs,
     then asserts trigger-maintained cover state matches a fully
     recomputed-from-scratch snapshot (LISTING.md §16). Second SQL
     test (`bulk_rebuild_per_cover.sql`) pins the P5-4 functions +
     the threshold-flip rebuild path. Both run via
     `tests/sql_tests.rs` against the dev DB; embedded-migrations
     runner (`bin/run_migrations`) applies migrations without
     letting diesel-CLI regenerate `schema.rs`.

## Phase 6 — Second consumer

Service decision: **new `realtime-server`** (general per-channel
event API; chat is one app on top) instead of Pektin / manager.
Both candidates required a multi-week infrastructure shift to land
Postgres before any auth wiring could start (Pektin is Redis-only,
manager is in-memory). A clean-slate realtime service is the
fastest path to "engine validated against two consumers" + ships
with the right shape (per-resource ownership, per-resource
read/write actions, group-shared resources). The original
`chat-server` design was generalized to `realtime-server` after
Round 5 once the use-case set widened to cover WebRTC signaling,
presence, and arbitrary event-kind fanout. Full design + multi-round
task board lives in [`.plans/realtime-service/`](../realtime-service/).

- ✅ Pick service — realtime (see `.plans/realtime-service/IDEA.md`)
- ✅ Round 1 scaffolding (`Cargo.toml` + workspace registration +
     bootstrap modules + initial migration + boot-then-health
     verified against the dev DB)
- ✅ Round 2 — engine schema + registration (`realtime-server` ships
     its own consolidated `access_policies` migration; user_groups
     / audit_log / cover-tables deferred to Round 7 to keep the
     MVP slice tight). `ChatPolicyStore` impl of all 5
     `mows_auth_core::PolicyStore` methods landed in the same
     round; ResourceTypeRegistry with `Channel = 0` and 3 other
     types boot-validated. Duplication finding tracked in
     `.plans/realtime-service/IDEA.md` as the trigger for extracting
     `EngineBackedPolicyStore` into the engine when a third
     consumer arrives.
- ✅ Round 4 — REST handlers wired through `check_resources_access_control`
     + `list_visible_resource_ids` (channels::create/get/list/update/
     delete + channels::events::publish/list + policies::create/list/
     delete + dev::seed). Every handler that touches a Channel calls
     into mows-auth-core; no auth SQL is hand-rolled in realtime-server.
     Two-pane demo client at `/demo/` + standalone React app at
     `apps/chat/` both exercise the surface.
- ✅ Round 5 — WebSocket `/api/channels/{id}/live` with in-process
     `tokio::broadcast` fanout. Explicit `Ready` handshake frame
     eliminates the subscribe-vs-publish race; `Lagged` frame
     reports per-subscriber drops; payload reshape (Round 7-prep)
     generalised messages → `channel_events` with opaque JSONB +
     optional `event_kind` so chat / WebRTC signaling / presence
     all ride the same primitive.
- ✅ Round 6 — Rust end-to-end test (`tests/end_to_end.rs::end_to_end_demo_flow`)
     covers: seed → create channel → publish chat event → REST list
     → WS subscribe → Ready handshake → publish via WS → frame
     received → demo path-traversal 404. SQL-only test suite for
     channel visibility (mirrors filez's pgTAP tests) is **❌
     remaining work** for full Round 6 close-out.
- ✅ Round 7 — cross-service E2E (share a channel with a
     user-group; every member sees it via list). Landed the
     minimal schema slice (migration 00000000000002 adds
     `user_groups` + `user_user_group_members`); the auth
     middleware resolves caller memberships once per request and
     hands them to `mows_auth_core::Subject::User.groups` so
     `RealtimePolicyStore` matches `UserGroup`-subject policies
     against the resolved set. End-to-end regression in
     `tests/end_to_end.rs` proves both directions: Bob (member of
     team-a) sees a group-shared channel via `/api/channels/list`;
     Carol (non-member) does not; the direct
     `check_resources_access_control` call mirrors the verdict.
     Group-lifecycle UX (invite / leave / request-to-join) +
     cover-tables stay deferred — realtime-server has no
     group-management surface yet and the engine validates without
     them. Engine now validated against two consumers under
     group-share.

## Phase 7 — Cross-service authz admin service

The original framing put this in the MOWS manager; corrected
2026-05-30 — see ROADMAP.md for the architectural reason. The
admin UI is its own cluster service (`apis/cloud/authz-admin/`)
that calls each consumer's `/api/access_policies/*` surface.

- ✅ Scaffold `apis/cloud/authz-admin/` (Rust+axum BFF + React SPA).
     Three commits this session: `da864de3` (server skeleton +
     config + upstream registry + health/upstreams endpoints),
     `0e82ee3c` (single-upstream `/api/access_policies/explain`
     forwarder with auth passthrough), `c620fae5` (React SPA with
     per-upstream tab, explain table, AuthReason breadcrumbs).
     Browser-verified end-to-end against running realtime-server:
     Alice's owned channels render as `Owned`; Bob's
     UserGroup-shared channel renders as
     `AllowedByDirectUserGroupPolicy` with the citing group id
     in the detail column.
- ✅ Per-consumer `/api/access_policies/explain` endpoint
     (returns visible resources + per-resource AuthReason).
     **Realtime side** (commit `3653a7cc`) — exposes Owned /
     AllowedByDirectUserPolicy / AllowedByDirectUserGroupPolicy /
     etc. variants verbatim from `mows_auth_core::AuthEvaluation`.
     End-to-end regression in `tests/end_to_end.rs` covers Alice
     (Owned), Bob (AllowedByDirectUserGroupPolicy citing the
     correct group), Carol (empty).
     **Filez side** — identical wire shape (`auth_evaluations:
     Vec<AuthEvaluation>`); thin two-step composition over
     `AccessPolicy::get_all_resources_with_user_access` +
     `AccessPolicy::check`. openapi.json regenerated;
     typescript client republished via yalc to filez/web +
     filez/components/react.
- ✅ Per-resource share dialog (generic primitive that fans out
     to the right consumer). Landed in
     `components/react/lib/components/identity/shareDialog/` —
     callback-driven, four subject kinds, action-implication
     closure, Allow/Deny gate, submission-race-protected. The
     channel-only chat ShareDialog was deleted and replaced with
     the generic primitive in apis/cloud/realtime/apps/chat/.
     19 vitest cases + DocPage with 4 modes (Default / AllowDeny /
     PublicOnly / Rtl). Multi-review round 1 dispositions in
     `.plans/authorization/phase7-share-dialog-review/issue.md`.
- ✅ "What can I see?" diagnostic panel — landed via the explain
     endpoint + per-upstream tab in `c620fae5`; renders allow/deny
     + AuthReason variant + policy_id + via_user_group_id
     breadcrumb.
- ✅ "Who can see X?" diagnostic panel — landed via the
     `POST /api/access_policies/by_resource` endpoint on both
     realtime + filez (shared `{resource_type, resource_id}` ->
     `{resource_owner_id, policies}` wire shape) + a single-upstream
     forwarder on the authz-admin BFF + a `ByResourcePanel` in the
     SPA below the existing explain table. Owner-only gate
     (existence + ownership collapsed into one 403 to defeat UUID
     fingerprinting), `revoked` + expiration filter mirrors the
     engine, ownership-check + policy-fetch wrapped in one
     diesel-async transaction so the OwnedByOwner filter sees a
     consistent snapshot. 15 BFF integration tests (incl. 6 new
     for by_resource: happy path, anonymous-401, unknown-upstream,
     upstream-403 surfacing, missing-field, oversize body,
     invalid-uuid 400), realtime e2e regression covers happy path,
     non-owner forbidden, anonymous, bogus-id 403 collapse,
     revoked-policy-filtered, owner-shortcut-not-as-row negative
     assertion. Multi-review round 1 dispositions in
     `.plans/authorization/phase7-by-resource-review/issue.md`
     (16 findings — all actionable items addressed, 7 deferred).
- ❌ User-group directory (Phase 4 frontend ships building blocks;
     host-app routing/mounting is Phase 7)
- ✅ App revocation panel (APP_AUTHORIZATION.md §7). Two new
     endpoints per upstream: `POST /api/access_policies/granted_apps/list`
     (returns every app the caller has granted at least one
     non-revoked policy to, with per-app count) and `POST
     /api/access_policies/revoke_by_app` (bulk-flips
     `revoked = TRUE` on every matching row in one UPDATE,
     idempotent — a no-op second call returns 0). Realtime emits
     `AppPoliciesRevoked` audit rows on every call (incl.
     no-ops) so the timeline shows the operator's intent; filez
     audit row is a tracked Phase-7 follow-up. Authz-admin BFF
     forwards both via the shared http_api::forwarder helpers
     (identity-header guard, body-size cap, header passthrough).
     SPA's fourth per-upstream panel lists granted apps + offers
     a two-step confirm (Revoke all → 5s armed → Confirm)
     with timer cleanup via useRef so back-to-back clicks +
     unmounts don't leak callbacks. 9 new BFF integration tests
     (incl. unknown-upstream + 500-surfacing parity with the
     other 3 forwarders), debug-query SQL guards on both
     upstreams pin the load-bearing `owner_id = caller AND
     revoked = false` filter. Multi-review round 1 dispositions
     in `.plans/authorization/phase7-app-revocation-review/issue.md`.
- ✅ Audit log viewer. Realtime ships a new audit_log table
     (migration 00000000000003) + AuditEvent enum (5 variants:
     ChannelCreated/Updated/Deleted + AccessPolicyCreated/Deleted)
     + writer wired at all 5 mutation handlers. Filez gains the
     missing `GET /api/audit_log/list` endpoint backed by the
     Phase-5 audit_log table. Both upstreams agree on the wire
     shape (`{resource_type?, resource_id?, limit, cursor}` →
     `{entries, next_cursor}`) so the authz-admin BFF forwards
     verbatim. Owner-only resource scope (collapsed 403 with
     not-found), self-scope when no filters supplied, keyset
     pagination via opaque `<ts_iso>|<id>` cursor. SPA panel
     joins explain + by_resource as the third per-upstream
     panel; cursor-collision guard prevents infinite "Load more".
     Multi-review round 1 dispositions in
     `.plans/authorization/phase7-audit-log-review/issue.md`.

## Phase 8 — Capability tokens (deferred unless demanded)

- ❌ Per-link signed capability tokens (OPEN_QUESTIONS Q11)
