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

- ❌ Pick service (default: Pektin)
- ❌ Shared crate migration alongside service schema
- ❌ Register service resource types & actions
- ❌ Wire check + list into handlers
- ❌ Cross-service E2E test

## Phase 7 — Manager-UI surface

- ❌ Per-resource share dialog
- ❌ "What can I see?" / "Who can see X?" diagnostic panel
- ❌ User-group directory (Phase 4 frontend ships building blocks;
     host-app routing/mounting is Phase 7)
- ❌ App revocation panel
- ❌ Audit log viewer

## Phase 8 — Capability tokens (deferred unless demanded)

- ❌ Per-link signed capability tokens (OPEN_QUESTIONS Q11)
