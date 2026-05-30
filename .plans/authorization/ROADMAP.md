# ROADMAP — Implementation order

Each phase is a separate PR (or small PR series). Each ends in a
mergeable, test-covered, observable state. Tasks within a phase are in
suggested order; some can parallelise.

Status legend in PLAN.md (sibling): ✅ done, ❌ blocked / not done. Items
here track the *shape* of the work, not the day-by-day status.

---

## Phase 0 — Validate the design

**Goal.** Make sure the design is robust before moving any code.

- [ ] Walk through ARCHITECTURE.md + DATA_MODEL.md + POLICY_SEMANTICS.md
      with Paul. Capture corrections.
- [ ] Run `multi-review` on the design set (as per CLAUDE.md). Address
      every flagged issue.
- [ ] Resolve OPEN_QUESTIONS Q1–Q3 (crate-vs-sidecar, type-int space,
      expiration enforcement). These shape the crate boundary.
- [ ] Confirm with Pektin / future-service owners that the
      resource-type-integer partitioning and the `ResourceTypeRegistry`
      trait fit their use cases.

Exit: design documents are signed off; no blocking question remains.

---

## Phase 1 — Extract `mows-auth-core` (no behaviour change)

**Goal.** A new crate exists. Filez consumes it. Nothing else changed.

- [ ] Create `utils/mows-auth-core/` with `Cargo.toml` and the module
      skeleton from DATA_MODEL.md §1.
- [ ] Move filez modules:
    - [ ] `models/access_policies/` → `mows-auth-core::policies` (rename
          types: `FilezUserId` → `MowsUserId`, etc.; keep type aliases in
          filez for the transition).
    - [ ] `models/users/` (sans filez-specific FKs) → `subjects::user`.
    - [ ] `models/apps/` → `subjects::app`.
    - [ ] `models/user_groups/` + `user_user_group_members/` →
          `groups::users`.
    - [ ] `models/access_policies/check.rs` → `check.rs`, with the
          hardcoded `get_auth_params_for_resource_type` replaced by the
          `ResourceTypeRegistry` trait + lookup.
- [ ] Filez registers its types in a `FilezResourceRegistry` and passes
      it to the engine at startup (`state::ServerState`).
- [ ] All existing filez tests pass against the new crate boundary.
- [ ] Add unit / integration tests *in the crate* mirroring the filez
      tests (so the engine has its own test suite).
- [ ] Wire tracing instrumentation as today (filez patterns).

**Multi-review prerequisites** (filez bugs discovered during the
.plans/authorization review that must be fixed *before* extraction —
otherwise the bugs propagate into mows-auth-core):

- [ ] **ARCH-1 (filez audit-reason bug)** — in
      `apis/cloud/filez/server/src/models/access_policies/check.rs:298–307`
      and `:344–357`, the Public/ServerMember Deny variants are
      incorrectly mapped to `AllowedByPubliclyAccessible` /
      `AllowedByServerAccessible` instead of the Denied variants.
      Fix the two match arms; add a unit test asserting `(Public, Deny)`
      yields `DeniedByPubliclyAccessible`.
- [ ] **ARCH-11 (filez SQL typo)** — in
      `apis/cloud/filez/server/src/models/access_policies/mod.rs:518`,
      the anonymous resource-group branch uses `context_app_id` (singular)
      where the column is `context_app_ids` (plural). Returns zero
      resource-group results for all anonymous users today. Fix the typo;
      add a test for anonymous users accessing a resource via a
      Public-shared resource-group.

Exit: filez tests are green; no diff in observable behaviour; crate
ships only what filez already had.

---

## Phase 2 — Additive schema for the new primitives

**Goal.** The shared crate ships the new columns and tables from
DATA_MODEL.md §2. Everything keeps working at the old behaviour.

- [ ] Diesel migration in `mows-auth-core/migrations/`:
    - [ ] add `user_groups.visibility`, `user_groups.join_policy`,
          `user_groups.description`.
    - [ ] add `user_user_group_join_requests`,
          `user_user_group_invitations`.
    - [ ] add `access_policies.resource_scope`,
          `access_policies.expires_at`, `access_policies.revoked`.
    - [ ] add the `ap_lookup_idx`, `ap_subject_idx`, GIN indexes.
    - [ ] add `public_resources`, `server_member_resources`,
          `user_group_accessible_resources` cover tables and their
          sort-key indexes.
    - [ ] add the per-resource-table sort indexes
          (`owner_created_id_idx`, `created_id_idx`, `modified_id_idx`).
- [ ] Type-side additions in `mows-auth-core::types`: `ResourceScope`,
      `GroupVisibility`, `GroupJoinPolicy` enums.
- [ ] Engine updates:
    - [ ] `check` honours `revoked` and `expires_at` (partial-index +
          `WHERE` clause).
    - [ ] `check` evaluates `resource_scope = OwnedByOwner` and
          `AccessibleByOwner` (POLICY_SEMANTICS.md §4).
    - [ ] Triggers maintaining `public_resources` and
          `server_member_resources` cover tables (LISTING.md §6, §12).
    - [ ] Large-user-group threshold detection + maintenance of
          `user_group_accessible_resources` (LISTING.md §6.2).
    - [ ] Recursive `AccessibleByOwnerSource` for the listing engine
          with the depth=1 cycle-break (POLICY_SEMANTICS.md §4,
          LISTING.md §7). No materialised expansion table.
- [ ] Property tests for the new evaluation paths (POLICY_SEMANTICS.md §9).
- [ ] Backwards-compat verification: all existing `access_policies` rows
      now carry `scope=Single, revoked=FALSE, expires_at=NULL`. No
      change in observed behaviour for them.

Exit: shared crate fully expresses IDEA.md's self-owned + shared
patterns. Filez still uses only the old shape.

---

## Phase 3 — Listing engine (scale-validated)

**Goal.** Replace filez's `get_all_resources_with_user_access` with the
crate's layered listing planner (LISTING.md §3–§9). Validate at the
target scale (10k users, 10M resources, 1M policies, 1M Public shares).

- [ ] Implement `ListingPlan` planner with `OwnerOnly` and
      `AuthMediated` arms (LISTING.md §4, §8).
- [ ] Implement the `SortedStream` trait and the seven source
      implementations (Owned, DirectPolicy, ResourceGroup,
      PublicCover, ServerMemberCover, LargeUserGroupCover,
      AccessibleByOwner-recursive) — LISTING.md §5, §7.
- [ ] Keyset pagination is the engine default; OFFSET is opt-in
      slow-path with approximate-count helper (LISTING.md §5.4, §10).
- [ ] Filez `list_with_user_access` calls delegate to the crate via
      the planner.
- [ ] Connection-pool budget: at most one connection per request
      regardless of source count (LISTING.md §13).
- [ ] Criterion benchmarks per scenario from LISTING.md §9.
- [ ] Prometheus histograms + the cover gauges (LISTING.md §14).
- [ ] Synthetic load test at the §1 target sizes, asserting each
      SLO from §9. Commit to `mows-auth-core/tests/load/`.

Exit: every scenario in LISTING.md §9 meets its SLO on the load
fixture. Filez owner-only listings touch zero rows of
`access_policies` (asserted by a profiler test). Dashboards live.

---

## Phase 4 — User-group lifecycle

**Goal.** Ship the visibility/join_policy/invite/request endpoints.

- [x] HTTP endpoints (filez first, since it's the only consumer today)
      from USER_GROUPS.md §6.
- [x] OpenAPI / typescript client regeneration (`bash scripts/codegen.sh`).
- [ ] Frontend UI in the filez UI (or the manager UI, depending on which
      ships group management first). **Out of scope for the Phase 4
      backend batch — tracked separately.**
- [ ] End-to-end tests for the lifecycle paths from USER_GROUPS.md §2.
      Source-grep + diesel-debug_query structural guards landed; full
      e2e against a real postgres requires the test infra Phase 5
      introduces.
- [x] Audit-event emission for invite, accept, reject, leave, transfer,
      delete (per OPEN_QUESTIONS Q9). audit_log table + AuditEvent
      enum landed in Phase 5 P5-1; the §7.2 / §7.5 call sites now
      write durable rows alongside the existing tracing::info!
      events.
- [x] Default policy bootstrap in `UserGroup::create_one` (members
      get `UserGroupsList`/`UserGroupsListUsers`; ServerMember gets
      `UserGroupsRequestJoin` when join_policy != InviteOnly).
      Server-wide ServerMember UserGroupsList grant landed in
      migration 00000000000016. Owner remains covered by the
      implicit owner-grant.

Exit (backend): HTTP endpoints from USER_GROUPS.md §6 are shipped,
documented in openapi.json, and gated by the right policy actions.
A user can hit `POST /api/user_groups/{id}/join_requests` against a
`RequestToJoin` group, the owner can list pending requests and
`POST .../approve`, and the user becomes a member. End-to-end via
API.

Exit (UI): tracked as a separate milestone — the API surface is
stable enough to build against.

---

## Phase 5 — Cover-table reconciler + adaptive group threshold

**Goal.** Harden the cover-table machinery and turn the
"large group" threshold into a measured rather than a constant.

- [ ] Background reconciler: periodically (per shift, or after a
      detected crash) rebuilds a single cover row set from
      authoritative state and reconciles drift. Emits
      `cover_drift_rows` metric.
- [ ] Per-cover bulk-rebuild API used when a group crosses the
      `large` threshold (LISTING.md §6.2): drains live `DirectPolicy`
      reads on the affected group and inserts the cover rows in
      batches.
- [ ] Adaptive threshold: instead of a fixed 1,000-member cut-off,
      the engine maintains a per-group score
      (`members × distinct_recent_lists`) and promotes the most
      valuable N groups to cover-backed. The threshold is observable
      and overridable.
- [ ] Reconciler test: random-walk policy/membership churn for 60s,
      then assert cover state matches a recomputed-from-scratch
      reference (LISTING.md §16 "Cover consistency").

Exit: cover drift stays at zero in the load test; the threshold's
N-most-valuable groups adapt within minutes of a workload shift.

---

## Phase 6 — Second consumer (Pektin or manager)

**Goal.** Validate that the engine generalises by onboarding a second
service.

- [ ] Pick: most likely Pektin DNS records, which already have
      per-record ownership semantics.
- [ ] Service adds the shared `mows-auth-core` migration alongside its
      existing schema.
- [ ] Defines its own resource types and actions, registers them.
- [ ] Wires `check` + `list_allowed` into its handlers.
- [ ] End-to-end test: share a DNS zone with a user group via the
      manager UI; the user can edit records of that zone only when
      acting from an app the share allows.

Exit: two services run on the same engine. Any future bug is one fix
in the crate, propagated to all consumers.

---

## Phase 7 — Manager-UI surface

**Goal.** A single cross-service admin UI to inspect / edit policies
across the cluster.

**Architecture correction (2026-05-30).** The original wording put
this UI inside the MOWS *manager*. That was wrong: the manager is
bootstrap + lifecycle infrastructure for nodes/clusters, not a host
for operational dashboards. The cross-service authz admin UI is a
regular cluster service in its own right — own image, own
deployment, served through traefik, talks to each consumer
service's `access_policies` endpoints over the same network as any
other client. Working name: `apis/cloud/authz-admin/`.

- [ ] Scaffold `apis/cloud/authz-admin/` (Rust+axum BFF + React SPA)
      following the filez/realtime shape — Cargo workspace entry,
      Dockerfile, dev compose, MowsApp registration.
- [ ] Per-resource share dialog (reusable across services).
- [ ] "What can I see?" / "Who can see X?" diagnostic panel,
      backed by per-consumer `/api/access_policies/explain` endpoints.
- [ ] User-group directory with full lifecycle UX.
- [ ] App revocation panel (APP_AUTHORIZATION.md §7).
- [ ] Audit log viewer (filter by user, app, resource, time).

Exit: an administrator can answer any reasonable authorization question
without `psql`, via the cluster-served admin UI.

---

## Phase 8 — Capability tokens for public links (OPEN_QUESTIONS Q11)

If demanded by users. Otherwise defer.

---

## Cross-cutting / continuous

- Every PR adds tests. No "test later" items.
- Every schema change is a forward + (reasonable) backward migration.
- Every public function gets `#[tracing::instrument]` (filez convention).
- Errors stay typed with `thiserror` (CLAUDE.md preference).
- After each phase, run `multi-review` and address findings before
  moving to the next phase.

---

## What we are *not* committing to in this roadmap

- A separate sidecar service for auth (OPEN_QUESTIONS Q1).
- Full role/template system (Q5).
- Hierarchical resource paths (Q8).
- Capability tokens before v2 (Q11).
- Multi-cluster federation (out of scope entirely).

Each of these has a paragraph in OPEN_QUESTIONS.md and can be added
later without restructuring the engine.
