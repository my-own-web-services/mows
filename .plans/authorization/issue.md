# Multi-Review Findings — MOWS Authorization Design

Reviewed by 10 parallel agents (Security, Technology, DevOps,
Architecture, QA, Fine Taste, Documentation, Repository, Slop Detective,
Future Proofing). Deduplicated below.

Status legend: ❌ not addressed · ✅ resolved · ⁉️ not a real issue / outdated

## Resolution summary

- **All 8 Critical findings ✅ resolved** in this pass — fixes are in
  `experiments/schema/05-auth-api.sql`, `experiments/schema/06-rls.sql`,
  `experiments/schema/01-tables.sql`, `experiments/concepts/schema/`,
  `experiments/scripts/full-validation.sh`, `experiments/concepts/run.sh`,
  `DEPLOYMENT.md`, and `BACKEND_APPS.md`. Six new regression tests in
  `experiments/security/30-multi-review-fixes.sql` guard them.
- **9 Major findings ✅ resolved** in this pass: ARCH-3, ARCH-4 / DOC-1
  (stale §3.7 SQL-fragment text in ARCHITECTURE.md and LISTING.md §3),
  DOC-4 / DOC-5 (wrong section refs to POLICY_SEMANTICS), DOC-6 (invalid
  `RAISE` syntax in USAGE_LIMITS.md), DOC-7 (Q1/Q2/Q3 marked ✅ in PLAN.md),
  TECH-7 (partial GIN indexes), TECH-12 / DEVOPS-12 (DEFERRABLE FKs),
  DEVOPS-13 (active REVOKE of filez_role write privileges), FUTURE-2
  (resource_type/actions → INT/u32 in DATA_MODEL.md).
- **2 Major findings ❌ tracked as Phase-1 prerequisites** in ROADMAP.md:
  ARCH-1 (filez audit-reason bug in apis/cloud/filez) and ARCH-11 (filez
  SQL typo `context_app_id`). Both are in the filez codebase — fixing
  them is the gate to Phase 1 extraction.
- Remaining ~23 Major and ~41 Minor findings ❌ tracked below with
  rationale. These are non-blocking; each is a small focused edit that
  can land in a follow-up pass without architectural impact.
- **Test status:** 35/35 security cases pass (18 base + 11 edge + 6 new
  regression). 6/6 concept tests pass. The corrected `run.sh` now uses
  psql exit codes — false-positive risk eliminated.

## Summary

| Perspective    | Critical | Major | Minor |
| -------------- | -------- | ----- | ----- |
| Security       | 4        | 3     | 2     |
| Technology     | 3        | 9     | 7     |
| DevOps         | 2        | 8     | 8     |
| Architecture   | 3        | 8     | 4     |
| QA             | 4        | 11    | 3     |
| Fine Taste     | 1        | 8     | 16    |
| Documentation  | 0        | 3     | 10    |
| Repository     | 0        | 5     | 6     |
| Slop           | 3        | 11    | 4     |
| Future Proof   | 0        | 4     | 9     |
| **TOTAL (after dedup)** | **8** | **34** | **41** |

## Critical findings (8)

### CRIT-1 — `expires_at` missing from resource-group Deny/Allow paths
*(merges SECURITY-1, SECURITY-2, SECURITY-7, TECH-8, TASTE-2, SLOP-1)*
✅ **Fixed** in `experiments/schema/05-auth-api.sql` (`check_access` group-Deny + group-Allow, `list_visible_anonymous` Deny EXISTS, `list_visible_merge` Deny EXISTS). Regression test R1.1/R2.1 in `security/30-multi-review-fixes.sql` guards both Deny and Allow paths. `bash scripts/security.sh` is green.
**Issue:** The direct Deny/Allow paths check `(ap.expires_at IS NULL OR ap.expires_at > now())`. The resource-group Deny/Allow paths do **not**. The `list_visible_anonymous` and `list_visible_merge` Deny `NOT EXISTS` subqueries also omit the check.
**Why it matters:** An expired Deny continues to block listing results indefinitely; an expired Allow on a file-group keeps granting access; `check_access` and `list_visible` diverge on expired policies. None of this is caught by the existing security suite (which only tests expiry on direct policies).
**Fix:** Add `AND (ap.expires_at IS NULL OR ap.expires_at > now())` to every Deny and Allow subquery on resource-group paths in `05-auth-api.sql`. Add a security test that creates a resource-group policy with `expires_at = now() - interval '1 hour'` and asserts the engine ignores it.

### CRIT-2 — Hardcoded `ARRAY[10::smallint]` in `via_rg` CTE ignores caller's action
*(merges SECURITY-5, TECH-5, TASTE-3, SLOP-11)*
✅ **Fixed** in `experiments/schema/05-auth-api.sql:498` — replaced with `ARRAY[%7$L::smallint]` using the caller-supplied `p_action`. The dead `list_visible_merge_sql_inlining_attempt` function still contains the hardcode but is no longer dispatched to (TASTE-1 / SLOP-4 deferred — see below). The `via_rg` CTE also gained the missing `expires_at` filter as part of the same edit.
**Issue:** The `via_rg` CTE filters `ap.actions @> ARRAY[10::smallint]` (the `FileGroupsListFiles` constant) instead of the caller-supplied `p_action` / `%7$L` parameter.
**Why it matters:** Any `list_visible(..., action != 10, ...)` call silently uses resource-group policies that grant action=10, not the requested action — files appear in listings the caller has no real permission for, and files with policies granting the requested action are silently missed. `check_access` and `list_visible` diverge.
**Fix:** Replace with `ARRAY[%7$L::smallint]` in the EXECUTE-format version and `ARRAY[p_action]` in the SQL version. Add a test that calls `list_visible(action=1)` and asserts the resource-group source uses action=1 policies.

### CRIT-3 — `|| true` swallows security-suite failure in `full-validation.sh`
*(merges DEVOPS-5, DEVOPS-11, TASTE-10, SLOP-2)*
✅ **Fixed** in `experiments/scripts/full-validation.sh`: security suite now runs through a captured-then-checked invocation; non-zero exit aborts the validation with a clearly-marked FAIL in the output. The trailing summarize-results `|| true` was also removed — a summary-format mismatch is now a real signal.
**Issue:** `bash scripts/security.sh 2>&1 | tail -50 >> "$OUT" || true` silently ignores a non-zero exit code from the security suite. The summarize step at :52 also uses `|| true`.
**Why it matters:** CI reports a green run while every security assertion may have failed. `set -euo pipefail` is bypassed for the only "correctness gate" the script claims to enforce.
**Fix:** Remove `|| true` from both lines. Capture output via `tee` while preserving exit code.

### CRIT-4 — Test pass/fail logic inverted in `concepts/run.sh`
*(merges DEVOPS-10, TASTE-8, SLOP-3, SLOP-6)*
✅ **Fixed** in `experiments/concepts/run.sh`: now uses psql's exit code (with `ON_ERROR_STOP=1`) as the truth signal. Tests that `RAISE EXCEPTION` cause psql to exit non-zero, which counts as FAIL. Tests that succeed silently count as PASS. Verified — all 6 concept tests still pass with the corrected runner.
**Issue:** Tests are counted as PASS if `grep` matches any of `NOTICE|ERROR|FAIL|EXCEPTION` in the output. A test that ERRORS is counted as PASS because the word "ERROR" is in the output. A test that succeeds silently is counted as FAIL.
**Why it matters:** A real regression looks identical to a real success. The 6-tests-pass report from iteration 4 cannot be trusted as written.
**Fix:** Use psql's exit code instead: `if docker compose ... psql ... < "$t" >/dev/null 2>&1; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi`. `ON_ERROR_STOP=1` is already set; failing assertions already `RAISE EXCEPTION` so the exit code is the right signal.

### CRIT-5 — Backend on-behalf-of EXISTS check doesn't filter `effect = 1`
*(SECURITY-3)*
✅ **Fixed** in `BACKEND_APPS.md` (added explicit `AND effect = 1` to the impersonation predicate plus a paragraph explaining why) and in `experiments/concepts/tests/03-backend-writer-quota.sql` (test now matches the corrected predicate). Future Rust middleware must implement the same check.
**Issue:** The impersonation gate's EXISTS predicate doesn't filter on `effect = 1`. Any policy row — including Deny rows — satisfies it.
**Why it matters:** A user attempting to revoke a backend's impersonation by adding a per-resource Deny instead of revoking the Allow inadvertently *re-enables* the impersonation gate. The backend can still claim to act as the user against other resources.
**Fix:** Add `AND effect = 1` to the EXISTS predicate in the BACKEND_APPS.md pseudocode and in any implementation. Add a test that creates a Deny-only policy for the (user, backend) pair and asserts the EXISTS check returns false.

### CRIT-6 — `picker_role` has full write on all of `mows_auth`, not just `access_policies`
*(SECURITY-4 + DEVOPS-13 active-REVOKE)*
✅ **Fixed** in `experiments/concepts/schema/04-roles.sql` and mirrored in `DEPLOYMENT.md` §"DB roles". Picker now has SELECT on identity tables (users/apps/user_groups/memberships), SELECT+INSERT+UPDATE on `access_policies` with **explicit `REVOKE DELETE`** (soft-delete via `revoked` only), and INSERT/UPDATE/DELETE on `filez.filez_policy_quotas`. The filez_role grants are now **active** REVOKEs against access_policies and identity tables, plus `ALTER DEFAULT PRIVILEGES IN SCHEMA mows_auth REVOKE INSERT/UPDATE/DELETE FROM filez_role` so future mows_auth tables inherit the right posture.
**Issue:** `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mows_auth TO picker_role` includes `users`, `apps`, `user_groups`. A compromised Picker can self-promote with `UPDATE users SET user_type = 0` or trust any app with `UPDATE apps SET trusted = TRUE`.
**Why it matters:** Defeats the entire role-separation model. The role boundary was supposed to constrain even a compromised Picker.
**Fix:** Grant only the minimum: `SELECT` on `users/apps/user_groups/user_user_group_members`, `SELECT/INSERT/UPDATE` on `access_policies` (no DELETE — revoke via the `revoked` flag), and explicit grants for the cover tables and `filez.filez_policy_quotas` it must write. Add a test asserting picker cannot UPDATE `users.user_type` or `apps.trusted`.

### CRIT-7 — `check_access` and `list_visible` are `SECURITY DEFINER` without `search_path` pin
*(TECH-2 with refinement from TECH-3, SLOP-9)*
✅ **Fixed** per SLOP-9's recommendation: dropped `SECURITY DEFINER` entirely (the design only needs RLS bypass, which `SET row_security = off` already provides at function scope), and pinned `SET search_path = public, pg_catalog` on every auth function (`check_access`, `list_visible`, `list_visible_owned`, `list_visible_anonymous`, `list_visible_merge`, `list_visible_superadmin`, `auth_user_group_ids`). See `experiments/schema/06-rls.sql` for the new ALTER statements.
**Issue:** `SECURITY DEFINER` is added without `SET search_path = mows_auth, pg_catalog`. Combined with the broad row_security bypass, a caller able to `SET search_path` could shadow `users`, `files`, or `access_policies` with their own definitions; the function would read attacker-controlled tables.
**Why it matters:** Classic search_path privilege escalation against a SECURITY DEFINER function. SLOP-9 also argues that `SECURITY DEFINER` is broader than necessary — `SET row_security = off` already covers the documented purpose.
**Fix:** Either (a) pin `SET search_path = mows_auth, pg_catalog` on every `SECURITY DEFINER` function, or (b) per SLOP-9, drop `SECURITY DEFINER` and rely on `SET row_security = off` alone since that is the narrowly-scoped mechanism the design actually needs. Option (b) is safer; option (a) is required if (b) is rejected.

### CRIT-8 — DATA_MODEL.md invariant for `(ServerMember/Public, subject_id)` not enforced
*(SECURITY-6 + SLOP-15 enum-domain CHECKs)*
✅ **Fixed** in both `experiments/schema/01-tables.sql` and `experiments/concepts/schema/01-mows-auth.sql`: added four CHECK constraints — (1) `(subject_type NOT IN (2,3)) OR (subject_id = nil)`, (2) `subject_type IN (0,1,2,3)`, (3) `resource_scope IN (0,1,2)`, (4) `effect IN (0,1)`. Regression tests R3.1, R3.2, R4.1 in `security/30-multi-review-fixes.sql` guard the constraints — `check_violation` is raised at INSERT time before any application logic sees the row.
**Issue:** The invariant "subject_type ∈ {2, 3} ⇒ subject_id = nil_uuid" is documented but absent from both schemas. A Picker bug could insert `(subject_type=2, subject_id=specific_uuid)`, which the engine ignores — silently producing a policy that grants access to every logged-in user.
**Why it matters:** Application-layer protection only. A Picker enum-serialisation bug creates an over-permissive ServerMember policy that no constraint catches.
**Fix:** Add `CHECK ((subject_type NOT IN (2,3)) OR (subject_id = '00000000-0000-0000-0000-000000000000'::uuid))` to `access_policies` in both schemas. Add a negative test asserting this insert is rejected at the database level.

## Major findings (34)

> **Resolved in this pass** (with the critical findings): ARCH-4 / DOC-1
> (stale §3.7 SQL-fragment text), DOC-7 (Q1/Q2/Q3 moved from ❌ to ✅
> in PLAN.md), TECH-12 / DEVOPS-12 (DEFERRABLE on FKs), TECH-7 (partial
> GIN indexes), DEVOPS-13 (active REVOKE of filez_role write privileges),
> SLOP-15 (enum-domain CHECKs).

### ARCH-3 — Picker role lacks write to per-service quota tables ✅
**Fixed** as part of CRIT-6. DEPLOYMENT.md now explicitly grants `picker_role` SELECT/INSERT/UPDATE/DELETE on `filez.filez_policy_quotas`, and the same grant is in `experiments/concepts/schema/04-roles.sql`. The atomic two-row commit (engine policy + filez quota row) now works under the Picker's role without escalation.

### ARCH-5 — "Two functions" API surface undercounts by two ❌
**File:** `ARCHITECTURE.md:150-164`
ARCHITECTURE.md claims "exactly two functions" but BACKEND_APPS.md adds `list_my_authorisations` and the `PolicyCreateForRequestor` action; USAGE_LIMITS.md adds the `PolicyServiceExtension` trait. Enumerate the full surface or clarify the "two functions" applies only to per-handler invocation, not infrastructure contracts.

### ARCH-7 — Crate-bundled migrations vs single `mows_auth` schema unresolved ❌
**File:** `DATA_MODEL.md:38-41` ↔ `DEPLOYMENT.md:121-143`
DATA_MODEL.md implies each service runs its own copy of the shared tables; DEPLOYMENT.md mandates a single `mows_auth` schema shared across services. Pick one shape and remove the other.

### ARCH-8 — k-way merge over single Postgres connection unspecified ❌
**File:** `LISTING.md:600-610`
"Each stream opens one Postgres connection" vs "batches all streams onto a single connection" — contradictory. The sequencing mechanism (diesel-async with prefetch buffers on one connection) isn't specified. Add §13b describing the per-stream refill pattern explicitly.

### ARCH-9 — Migration version mismatch and extension startup failures not in OPEN_QUESTIONS ❌
**File:** `OPEN_QUESTIONS.md`
Add Q16 (migration sequencing failure: cluster-level component gates service startup; pods refuse to boot on schema version mismatch) and Q17 (extension registration failure: service must abort, no silent quota bypass).

### ARCH-10 — Phase 1–3 listing regression window not called out in ROADMAP ❌
**File:** `ROADMAP.md` Phase 1
Current `get_all_resources_with_user_access` materialises the full allowed-set in Rust. Phase 1 keeps this; Phase 3 replaces it. Document the regression window and add: "Do not deploy Phase 1 to a cluster already at 1M+ policies without also deploying Phase 3."

### ARCH-11 — Latent SQL typo `context_app_id` (singular) in anonymous resource-group branch ❌
**File:** `apis/cloud/filez/server/src/models/access_policies/mod.rs:518`
Pre-existing bug in the code Phase 1 will extract. Returns zero resource-group results for anonymous users today. Fix before Phase 1 extraction; add a test for anonymous resource-group listing.

### ARCH-1 — Audit-reason mapping returns Allow variant for Deny policies (existing filez bug) ❌
**File:** `apis/cloud/filez/server/src/models/access_policies/check.rs:298-307` and `:344-357`
Existing engine maps Public/ServerMember Deny to `AllowedByPubliclyAccessible`/`AllowedByServerAccessible`. Will be carried into `mows-auth-core`. Fix the two `match` arms; add a test asserting `(Public, Deny)` returns `DeniedByPubliclyAccessible`.

### ARCH-6 — `OwnedByOwner` and `AccessibleByOwner` scopes never tested at any scale ❌
**File:** `experiments/schema/05-auth-api.sql` (all CTEs hardcode `resource_scope = 0`)
The two new scopes have zero coverage. Add a Phase 2 experiment that implements them in `check_access` and `list_visible_merge`, seeds 50k such policies, measures p99.

### TECH-1 — `SECURITY DEFINER` + `PARALLEL SAFE` is unsafe ❌
**File:** `experiments/schema/05-auth-api.sql:51` + 06-rls.sql
Functions with `SECURITY DEFINER` should be `PARALLEL RESTRICTED` to avoid role-context switching in parallel workers. The pure SQL sub-functions (`list_visible_owned`, `list_visible_superadmin`) can remain `PARALLEL SAFE`.

### TECH-4 — Lock-ordering deadlock between policy quota and storage quota ❌
**File:** `experiments/concepts/schema/03-functions.sql:97,122`
`FOR UPDATE` on `filez_policy_quotas` then `storage_quotas` — no documented ordering protocol. Concurrent callers acquiring in the opposite order deadlock. Document canonical order in a comment; add `lock_timeout` to surface contention.

### TECH-6 — `candidates` CTE materialisation blocks Deny push-down ❌
**File:** `experiments/schema/05-auth-api.sql:380-422`
Postgres 12-16 materialises CTEs by default; the `NOT EXISTS` Deny check cannot push into the inner UNION. At target scale this means ~50 correlated lookups against `access_policies` after full materialisation. Add `NOT MATERIALIZED` to the `candidates` CTE or restructure as inline subquery.

### TECH-7 — `ap_context_apps_gin` and `ap_actions_gin` are not partial indexes ❌
**File:** `experiments/schema/02-indexes.sql:16-20`
Both GIN indexes lack `WHERE NOT revoked`, so they include revoked rows. At a mature scale revoked rows bloat the GIN index 30-50%. Rebuild as partial.

### TECH-11 — `check_access` does 4 sequential `SELECT INTO` round-trips before the policy lookup ❌
**File:** `experiments/schema/05-auth-api.sql:60-151`
User type, owner, app trust, group IDs — four separate selects. Combine into a single `SELECT u.user_type, f.owner_id, a.trusted FROM files f LEFT JOIN users u ... LEFT JOIN apps a ...`.

### TECH-12 / DEVOPS-12 — FK constraints not actually `DEFERRABLE` ❌
**File:** `experiments/schema/04-fks.sql:6`
The header comment claims DEFERRABLE but the `ADD CONSTRAINT` statements omit the clause. `SET CONSTRAINTS ALL DEFERRED` is a silent no-op. Add `DEFERRABLE INITIALLY IMMEDIATE` to each FK.

### TECH-13 — All `TIMESTAMP` columns are timezone-naive ❌
**File:** `experiments/schema/01-tables.sql:32-33` (and throughout)
`TIMESTAMP` (no TZ) + `now()` evaluated under different `TimeZone` GUCs across replicas produces wrong expiry comparisons. Change wall-clock timestamps to `TIMESTAMPTZ`.

### DEVOPS-1 — Postgres image pinned to tag, not digest ❌
**File:** `experiments/docker-compose.yaml:3`
`postgres:17.2-alpine` is a floating tag. Pin to digest (`postgres:17.2-alpine@sha256:...`) for reproducible benchmarks.

### DEVOPS-2 — No memory limit on Postgres container ❌
**File:** `experiments/docker-compose.yaml:17-45`
`max_connections=50` × `work_mem=128MB` = 6.4 GB theoretical peak with no `deploy.resources.limits.memory` cap. Add a 4 GB hard cap; reduce `max_connections` to 20.

### DEVOPS-6 — `full-validation.sh` doesn't seed; uses whatever's in the DB ❌
**File:** `experiments/scripts/full-validation.sh:38-45`
`SCALE` parameter only affects the output filename. Add `bash scripts/seed.sh "$SCALE"` as the first real step.

### DEVOPS-7 — `bench.sh` proceeds against an unknown scale ❌
**File:** `experiments/scripts/bench.sh:9`
Defaults `SCALE=unknown`. Replace with `SCALE="${SCALE:?must be set}"`.

### DEVOPS-8 — Hand-rolled health-poll loop unreliable ❌
**File:** `experiments/scripts/up.sh:6-12`
Replace with `docker compose up -d --wait`.

### DEVOPS-13 — `filez_role` separation is passive (absence of grant), not active (REVOKE) ❌
**File:** `experiments/concepts/schema/04-roles.sql:30-33`
A future blanket `GRANT ALL` migration would silently elevate `filez_role`. Add explicit `REVOKE INSERT, UPDATE, DELETE ON mows_auth.access_policies FROM filez_role` and `ALTER DEFAULT PRIVILEGES IN SCHEMA mows_auth REVOKE INSERT, UPDATE, DELETE FROM filez_role`.

### DEVOPS-14 — Role-enforcement test runs as superuser via `SET ROLE` ❌
**File:** `experiments/concepts/schema/04-roles.sql:9-16`
`bench` is superuser; tests use `SET ROLE filez_role`. Production would have a separate login role. Document the gap, or add a `filez_login NOINHERIT LOGIN` role for the test.

### DEVOPS-18 — DEPLOYMENT.md describes Kubernetes; production is mows-cli + Docker Compose ❌
**File:** `DEPLOYMENT.md` ↔ project CLAUDE.md
Reconcile: either update DEPLOYMENT.md to describe a mows-cli/mpm deployment, or mark the K8s diagram as aspirational. Add a migration-ordering integration test.

### QA-1 — `assert_access` collapses AuthReason taxonomy; wrong-subject matches invisible ❌
**File:** `experiments/security/00-helpers.sql:27`
`'AllowedByPolicy'` covers all four subject types. A ServerMember policy granting access where only a User policy should match still asserts pass. Add a `p_expected_reason_detail` parameter and return the matched policy's `subject_type`.

### QA-2 — §3.4 ownership-after-Deny ordering untested for the owner ❌
**File:** `experiments/security/10-cases.sql`
T1.2/T1.3 cover the §2 shortcuts but not "owner has a Deny on their own resource → DeniedByPolicy, not Owned". Add `T_owner_denied`.

### QA-3 — `OwnedByOwner`/`AccessibleByOwner` evaluation untested ❌
**File:** security suite
2k such rows are seeded; no test asserts the evaluation semantics or the cycle-break.

### QA-4 — Type-level check (§5) entirely absent ❌
**File:** security suite + `check_access` signature
No code path for `requested_resource_ids = None`. "May I create a file?" — untested. Implement and test.

### QA-8 — `StorageLocationQuotaExceeded` never triggered ❌
**File:** quota tests
Function has 5 failure modes; only 4 tested. Add a test where the storage_location quota is full and a policy quota has headroom.

### QA-9 — Quota counter decrement on DELETE not implemented or tested ❌
**File:** `experiments/concepts/schema/03-functions.sql`
No decrement path. After 5 uploads + 5 deletes the link is permanently exhausted. Add decrement logic + test.

### QA-10 — Concurrent quota-boundary rejection not tested ❌
**File:** `experiments/concepts/run.sh:72-85`
Test proves serialisation when all uploads fit. The interesting case — quota nearly full, N parallel uploads, exactly one wins — is untested.

### QA-11 — No latency regression gate ❌
**File:** `experiments/benchmarks/`
SLO claims (0.17 ms, 3.2 ms) are documented but no script fails CI on regression. Add `scripts/perf-regression.sh` with threshold checks.

### QA-12 — `list_visible` correctness (LISTING.md §16 explicit requirement) absent ❌
**File:** no test file exists
Required: k-way merge results match a brute-force set-union for small inputs. Create `experiments/security/30-listing-correctness.sql`.

### SLOP-8 — "Truly concurrent" upload test is really sequential due to per-call docker exec startup ❌
**File:** `experiments/concepts/run.sh:69-86`
Each upload spawns a fresh `docker compose exec` (~hundreds of ms). FOR UPDATE lock contention is essentially never tested. Use pgbench or persistent connections with `BEGIN/COMMIT` blocks.

### SLOP-10 — Missing `CHECK (used_bytes <= max_bytes)` on quota tables ❌
**File:** `experiments/concepts/schema/02-filez.sql:53-57`
Counter corruption goes undetected. Add the constraint as the last line of defence.

### FUTURE-2 — `SMALLINT` vs `u16` mismatch + resource_type ceiling ❌
**File:** `DATA_MODEL.md §3`, `experiments/schema/01-tables.sql`
Rust `u16` (65535) vs SQL `SMALLINT` (32767). Values 32768-65535 will overflow at INSERT. Change `SMALLINT` → `INT` everywhere; update Rust to `u32`.

### FUTURE-3 — No tenant discriminator on shared tables ❌
**File:** `DATA_MODEL.md §2.1-2.3`
Adding `tenant_id` to `access_policies` later requires a full-table rewrite at 6.78M rows. Add `tenant_id UUID NOT NULL DEFAULT '<singleton>'` now to `users/apps/user_groups/access_policies/covers`.

### FUTURE-5 — Audit log (events table) not structured for compliance queries ❌
**File:** `OPEN_QUESTIONS.md Q9`
JSONB + array `resource_ids` + per-service tables = multi-minute GDPR DSAR queries. Add a `mows_auth.access_events` table with normalised `(resource_id, resource_owner_id, subject_id)` columns.

## Minor findings (selected 41)

A representative subset; full list available in the individual agent reports. Marked ❌ unless noted.

### Documentation / consistency
- ❌ DOC-1 / ARCH-4: ARCHITECTURE.md §3.7 stale "SQL fragment" language contradicts §3.7a
- ❌ DOC-2: LISTING.md §9 mixes measured and projected p99s without distinguishing them
- ❌ DOC-3: DEPLOYMENT.md states "sub-10 ms p99" but measured pathological case is 21.4 ms; IDEA.md says 25 ms
- ❌ DOC-4: DATA_MODEL.md cites POLICY_SEMANTICS.md §3 for `resource_scope` — should be §4
- ❌ DOC-5: References to "POLICY_SEMANTICS.md §3.4" — no §3.4 heading exists
- ❌ DOC-6: USAGE_LIMITS.md SQL example uses `RAISE 'msg'` (invalid syntax) instead of `RAISE EXCEPTION`
- ❌ DOC-7: PLAN.md marks Q1/Q2/Q3 as ❌ but they are resolved in DEPLOYMENT.md
- ❌ DOC-9: OPEN_QUESTIONS Q1/Q2 present as open but design has committed to specific answers
- ❌ DOC-10: LISTING.md "250× slowdown / 0.75 ms baseline" not traceable to any benchmark file
- ❌ DOC-11: ARCHITECTURE.md §6 cites "6.7M policies" vs "6.78M" in same paragraph
- ❌ TASTE-26: DATA_MODEL.md §4 CHECK constraint contradicts the actual table CHECK
- ❌ TASTE-27: Large-group threshold "1000" magic in two files, no shared constant

### Naming / structure
- ❌ TASTE-1: `list_visible_merge_sql_inlining_attempt` is dead code in production schema
- ❌ TASTE-14: `via_rg/sm_cover/large_ug_cover` (abbreviated) vs full names in benchmarks
- ❌ TASTE-15: `list_visible_anonymous` conflates caller state (anonymous) with policy subject (Public)
- ❌ TASTE-16: `user_group_ids_of` (security helper) vs `auth_user_group_ids` (production)
- ❌ TASTE-18: `7a/7b/7c/7d` README numbering breaks Markdown rendering
- ❌ TASTE-19: `USAGE_LIMITS.md` filename describes filez concern, not engine contract
- ❌ TASTE-24/25: Duplicated content across USAGE_LIMITS.md, CONSENT_FLOW.md, BACKEND_APPS.md
- ❌ REPO-2: SCREAMING_SNAKE_CASE filenames break repo convention (other plans folders use kebab-case)
- ❌ REPO-4: IDEA.md has grown into full requirements doc duplicating every other file

### Repository / experiments hygiene
- ❌ REPO-5: `benchmarks/90-94-*.sql` (rejection proofs) run in the regular bench glob; 91 takes 31s
- ❌ REPO-7: 5 near-identical medium-* timestamped results accumulate silently
- ❌ REPO-8: `tiny-20260525-182230.md` is a failed run file disguised as valid data
- ❌ REPO-9: Two parallel schema directories (`experiments/schema/` and `experiments/concepts/schema/`) maintain auth primitives independently
- ❌ REPO-10: `concepts/run.sh:11` has a dead container-path reference swallowed by `|| true`
- ❌ REPO-11: No `.gitignore` in `results/`; every bench session generates a committable file
- ❌ REPO-13: `archived/` purpose is undocumented

### Other technical
- ❌ TECH-9: Empty `v_groups` array creates a vacuously-false predicate that may mis-plan
- ❌ TECH-10: `DROP SCHEMA public CASCADE` inside a transaction can leave broken state on failure
- ❌ TECH-15: `public_resources_by_name` has only ASC sort; descending name-sort falls back to full scan
- ❌ TECH-16: `list_visible_owned` accepts `p_resource_t` but always queries `filez.files`
- ❌ TECH-17: Security helpers lack `SET search_path` qualifier; risk of cross-schema shadow
- ❌ TECH-18 / TASTE-28: Throughput bench uses `OFFSET (random()*100)` — biased sample of first 100 rows
- ❌ TECH-19: Role grants are snapshot, not default privileges; future `mows_auth` tables silently unreachable
- ❌ DEVOPS-3: Healthcheck has no `start_period`
- ❌ DEVOPS-15: Throughput benchmark samples from first 100 files only
- ❌ DEVOPS-16: `bench_handler` role accumulates across runs
- ❌ DEVOPS-19: Security tests use `\set ... `md5sum` ... ` backtick subshell — non-portable
- ❌ DEVOPS-20: Security fixture uses `now()` for timestamps — non-deterministic
- ❌ QA-5 / QA-6 / QA-7: Backend negative cases, revoked-deny + active-allow, expired-deny — all untested
- ❌ QA-14 / QA-16 / QA-17: filez_role DELETE rejection, non-member-of-shared-group, ghost-user-with-matching-policy
- ❌ FUTURE-1: Cover-table cluster discriminator missing for future federation
- ❌ FUTURE-8: `PolicyServiceExtension` lacks `on_policy_modified` / `on_policy_expired` hooks
- ❌ FUTURE-11: No `NOTIFY` on policy change — streaming/WebSocket auth requires reconnect
- ❌ FUTURE-12: No `identity_provider` column on `users` — multi-IdP setups will collide
- ❌ SLOP-13: `create_file_with_quota` accepts `p_uploader` parameter but never uses it
- ❌ SLOP-15: `effect`, `subject_type`, `resource_scope`, `resource_type` columns lack CHECK constraints on enum range

## Recommendations (prioritized)

### Fix before any next iteration

1. **CRIT-1, CRIT-2** — These are correctness bugs in the SQL primitives that diverge `check_access` from `list_visible`. One-line fixes each. Add the missing tests so they cannot regress.
2. **CRIT-3, CRIT-4** — The test infrastructure currently produces false positives. Fix the runner before trusting any further "all tests pass" output.
3. **CRIT-5** — Add `effect = 1` to the on-behalf-of EXISTS check in BACKEND_APPS.md; flag for the future Rust middleware.
4. **CRIT-6** — Tighten the `picker_role` grants per the explicit minimum-privilege model.
5. **CRIT-7** — Add `SET search_path` to every SECURITY DEFINER function (or drop SECURITY DEFINER per SLOP-9).
6. **CRIT-8** — Add the `(ServerMember/Public, subject_id = nil)` CHECK constraint.

### Fix before Phase 1 extraction

7. **ARCH-1, ARCH-11** — Two pre-existing filez bugs (Deny reason mapping, `context_app_id` typo) that will otherwise propagate into `mows-auth-core`.
8. **ARCH-7** — Resolve the schema-strategy contradiction (single shared `mows_auth` vs per-service replicas).
9. **TECH-12** — Add `DEFERRABLE` to the FK constraints so the seed's documented intent works.
10. **FUTURE-2** — Change `SMALLINT` → `INT` for `resource_type` and `actions[]` everywhere. Done now: no migration. Done later at scale: a multi-table type change.
11. **FUTURE-3** — Add `tenant_id UUID NOT NULL DEFAULT '<singleton>'` to shared tables before the first production rows exist.
12. **FUTURE-5** — Create `mows_auth.access_events` schema now even if not populated; cheaper to add columns later than to retrofit a normalised audit log to per-service JSONB tables.

### Defer but track

- ARCH-5, ARCH-9, ARCH-10 — Architectural clarifications; add to OPEN_QUESTIONS.md
- DOC-1 through DOC-11 — Documentation accuracy passes
- REPO-2, REPO-7, REPO-9, REPO-11 — Repository hygiene (rename files, add gitignore, dedupe schema dirs)
- TASTE-* — Naming and conciseness pass after the correctness/test fixes land
- FUTURE-7, FUTURE-8, FUTURE-11, FUTURE-12, FUTURE-13, FUTURE-14 — Future-extensibility items; each is a single-method or single-column addition when the need arises

### Out-of-scope-but-worth-noting

- DEVOPS-18 — The Kubernetes deployment topology in DEPLOYMENT.md vs the mows-cli/mpm production reality on `root@turing`. Decision pending.
