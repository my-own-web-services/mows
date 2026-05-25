# PLAN — MOWS Authorization (status board)

Following CLAUDE.md: each phase task uses ✅ (done) or ❌ (not done). The
roadmap-shape lives in [ROADMAP.md](./ROADMAP.md); this file is the
running status board.

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

- ❌ Create `utils/mows-auth-core/` skeleton
- ❌ Move `models/access_policies/` → crate `policies`
- ❌ Move `models/users/` → crate `subjects::user`
- ❌ Move `models/apps/` → crate `subjects::app`
- ❌ Move `models/user_groups/` + memberships → crate `groups::users`
- ❌ Move `check.rs` and replace hardcoded type map with `ResourceTypeRegistry`
- ❌ Filez registers types via `FilezResourceRegistry`
- ❌ All existing filez tests pass against new boundary
- ❌ Crate-level test suite mirrors filez tests
- ❌ Tracing instrumentation preserved

## Phase 2 — Additive schema for the new primitives

- ❌ Migration: user_groups visibility, join_policy, description
- ❌ Migration: user_user_group_join_requests, user_user_group_invitations
- ❌ Migration: access_policies resource_scope, expires_at, revoked
- ❌ Migration: new indexes (ap_lookup_idx, ap_subject_idx, GIN)
- ❌ Migration: cover tables (public_resources, server_member_resources, user_group_accessible_resources)
- ❌ Migration: per-resource sort indexes (owner_created_id_idx, created_id_idx, modified_id_idx)
- ❌ Types: ResourceScope, GroupVisibility, GroupJoinPolicy
- ❌ Engine honours revoked + expires_at
- ❌ Engine evaluates resource_scope = OwnedByOwner / AccessibleByOwner
- ❌ Triggers maintaining the cover tables (LISTING.md §12)
- ❌ Recursive AccessibleByOwnerSource (no closure table)
- ❌ Property tests for new evaluation paths
- ❌ Backwards-compat verification (old rows still behave identically)

## Phase 3 — Listing engine (scale-validated)

- ❌ `ListingPlan` planner (OwnerOnly + AuthMediated)
- ❌ `SortedStream` trait + seven source implementations
- ❌ Keyset pagination default; OFFSET opt-in slow-path with approximate count
- ❌ Filez `list_with_user_access` delegates to crate
- ❌ One-connection-per-request budget enforcement
- ❌ Criterion benchmarks per LISTING.md §9 scenario
- ❌ Prometheus histograms + cover gauges
- ❌ Synthetic load test (10k users, 10M resources, 1M policies, 1M Public shares) meets all SLOs
- ❌ Profiler assertion: owner-only listings touch zero policy rows

## Phase 4 — User-group lifecycle

- ❌ HTTP endpoints from USER_GROUPS.md §6
- ❌ OpenAPI / typescript client regen
- ❌ Frontend UI surface
- ❌ E2E tests for full lifecycle
- ❌ Audit-event emission

## Phase 5 — Cover-table reconciler + adaptive group threshold

- ❌ Background reconciler with `cover_drift_rows` metric
- ❌ Per-cover bulk-rebuild API for threshold-crossing groups
- ❌ Adaptive "large group" threshold using member × recent-list-count score
- ❌ Reconciler test (random-walk churn, then compare to recomputed reference)

## Phase 6 — Second consumer

- ❌ Pick service (default: Pektin)
- ❌ Shared crate migration alongside service schema
- ❌ Register service resource types & actions
- ❌ Wire check + list into handlers
- ❌ Cross-service E2E test

## Phase 7 — Manager-UI surface

- ❌ Per-resource share dialog
- ❌ "What can I see?" / "Who can see X?" diagnostic panel
- ❌ User-group directory
- ❌ App revocation panel
- ❌ Audit log viewer

## Phase 8 — Capability tokens (deferred unless demanded)

- ❌ Per-link signed capability tokens (OPEN_QUESTIONS Q11)
