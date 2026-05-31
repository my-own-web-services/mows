# Phase 7 App-revocation — multi-review round 1

Date: 2026-05-31
Scope: realtime + filez `granted_apps/list` and `revoke_by_app`
endpoints, the `AppPoliciesRevoked` audit event variant on realtime
(filez deferred), authz-admin BFF forwarders for both, SPA
AppRevocationPanel + unwrappers.

Reviewers: 3 parallel `Explore` agents (Security, Tech+QA, Slop).
Security came back clean (no exploitable findings). The other two
flagged 17 actionable items (some overlap across reviewers).

## Findings — dispositions

Severity legend: ▲ Critical · ◆ Major · ○ Minor

### R1 — SPA `setTimeout` without cleanup (TECH-6 / SLOP-1) ◆

`AppRevocationPanel.revoke()` calls `setTimeout(..., 5000)` to
auto-disarm the confirm button. The timer ID is never tracked,
so back-to-back clicks on the same row create overlapping timers
and an unmount during the 5s window leaks the callback (it then
calls `setArmed` on a stale closure).

**Disposition:** FIX. Track the timer in a `useRef` + clear on
re-arm + cleanup via `useEffect`.

### R2 — Error state overloaded for success messages (SLOP-2) ◆

`setError("Revoked N polic…")` uses the `error` state slot for
both failure and success. The SPA then string-matches
`.startsWith("Revoked")` to decide between `role="alert"` and
`role="status"`. Fragile (rewording the message breaks
accessibility) and semantically wrong (a success isn't an alert).

**Disposition:** FIX. Add a separate `lastResult` state with
proper status/alert split.

### R3 — Missing BFF tests for unknown-upstream + 500-surfacing (QA-1) ◆

The 5 new app-revocation BFF tests cover identity passthrough +
anonymous + invalid-uuid. They DON'T cover:
- `granted_apps_rejects_unknown_upstream`
- `revoke_by_app_rejects_unknown_upstream`
- `granted_apps_surfaces_upstream_500_under_upstream_status`
- `revoke_by_app_surfaces_upstream_500_under_upstream_status`

Other forwarders (explain / by_resource / audit_log) all have
these analogous tests. Drift risk.

**Disposition:** FIX. Add the 4 tests.

### R4 — No regression guard for `revoked=false` filter (QA-3) ▲

Both endpoints filter `schema::access_policies::revoked.eq(false)`.
A regression that drops the filter would silently let granted_apps
count already-revoked rows AND let revoke_by_app re-flip
already-revoked rows (the count would inflate). No test catches
this. The reviewer marked this Critical.

**Disposition:** FIX. Add a wire-shape-level guard via a
diesel debug-query test (no DB required) that pins the SQL
contains `revoked = false`.

### R5 — Self-referential "Review SLOP-11" comment in SPA (SLOP-11) ○

A comment in `AuditLogPanel.partialScope` says "Review SLOP-11"
referencing this same review by name — the review didn't exist
at the time the file was written. Stale forward-reference.

**Disposition:** FIX. Drop the self-reference, keep the
defense-in-depth explanation.

### R6 — Tighten the in-Rust-groupby bound comment (SLOP-7) ○

`granted_apps.rs` comment says "A typical user has <50 policies
and <10 distinct apps" without a measurement source. If the
assumption breaks the in-process group silently becomes a perf
problem.

**Disposition:** FIX. Tighten the bound + add a tracing::warn
when a user exceeds the assumption so the bound becomes
observable instead of an unwritten contract.

### R7 — BFF hardcoded `{}` body on granted_apps (TECH-5 / SLOP-3) ○

`forward_granted_apps` discards the inbound body and sends `{}`
to the upstream. Today the upstream's body shape IS `{}` so this
is correct — but a future filter parameter would silently not
forward.

**Disposition:** FIX. Strengthen the comment so a future
upstream extension forces a BFF update (the reviewer's
"forward-compat" concern). Today's behaviour is correct; the
comment is the only meaningful action.

### R8 — Filez audit asymmetry (TECH-3 / SLOP-6) ○

Realtime writes an `AppPoliciesRevoked` audit row per
revoke_by_app call; filez doesn't. Documented in filez's source
comment as a Phase 7 follow-up.

**Disposition:** ACCEPT. The asymmetry is explicit in the
disposition. Track as Phase 7 follow-up.

### R9 — Zero-count audit row on no-op revoke (TECH-4) ○

Realtime writes `AppPoliciesRevoked { revoked_count: 0 }` when a
second click finds nothing to revoke. Reviewer called it
"defensible but noisy".

**Disposition:** ACCEPT. The intent ("the operator clicked
revoke") IS worth logging; the noise is bounded by user actions,
not by data volume.

### R10 — Code duplication realtime ↔ filez (TECH-1 / SLOP-4) ○

The four endpoint pairs across the four Phase 7 strands
(explain / by_resource / audit_log / app_revocation) all have
~80-line realtime-vs-filez near-duplicates. Pulling them into a
shared crate is the right fix.

**Disposition:** DEFER. Repo-wide cleanup — needs a new
`mows-cloud-common` (or extension of `mows-auth-core`) and the
filez-vs-realtime types unified. Track as a Phase 8 cleanup.

### R11 — Raw SQL `context_app_ids @>` (TECH-2 / SLOP-5) ○

Both `revoke_by_app` files use `sql::<Bool>("context_app_ids @> ")`
plus a typed bind. Diesel's DSL doesn't ship a `.contains()` for
`Array<Uuid>` columns AFAIK. The bind is parameterised (security
review confirmed).

**Disposition:** ACCEPT. The raw SQL is the safe + idiomatic
compromise; add a comment noting the Diesel limitation so future
upgrades can replace it.

### R12 — E2E test for app-revocation pathway in realtime (QA-5) ○

A Round-8 test in `realtime/server/tests/end_to_end.rs` would
prove the full flow (grant → list → revoke → list-empty → second
revoke returns 0 → audit rows present). Strong regression guard.

**Disposition:** DEFER. The realtime end_to_end test needs a
real Postgres rig (REALTIME_TEST_DB_URL); adding the round
without running it locally first is dishonest. Track as a
follow-up when the rig runs in CI.

### R13 — BFF test deep-path brittleness (SLOP-8) ○

`body["data"]["upstream_body"]["data"]["apps"][0]["policy_count"]`
walks 5 layers. Same pattern the prior 3 reviews flagged + the
team accepted. Track for repo-wide cleanup, not per-strand.

**Disposition:** ACCEPT (consistent with prior strands).

### R14 — SPA unit tests for AppRevocationPanel (QA-6) ○

The two-step confirm logic isn't unit-tested. SPA test rig isn't
wired up in this repo yet.

**Disposition:** DEFER. Tracked alongside the broader SPA
testing rig gap.

### R15 — Wire-shape field assertions in BFF integration tests (QA-2) ○

The new 5 BFF tests cover happy-path + error envelopes but don't
explicitly assert the upstream-body field names
(`apps[0].app_id`, `apps[0].policy_count`, `revoked_count`).
The per-endpoint wire_shape_guard tests cover this at the
upstream side; the BFF tests would catch the BFF translating
between consumers if that ever happened.

**Disposition:** ACCEPT. The upstream-side guards are the right
home for field-name pinning; the BFF tests are translator-
free-passthrough proofs.

### R16 — SPA `revoke_by_app` UUID stringification (SLOP-10) — no action ○

The BFF forwards `context_app_id.to_string()`. Reviewer noted
the symmetry concern; no actual issue.

**Disposition:** ACCEPT. Stringification is the wire form.

### R17 — Audit-metadata field-shape coverage (QA-4) — no action ○

`AppPoliciesRevoked` metadata shape already has a
`metadata_field_stability_guard` test pinning `context_app_id` +
`revoked_count` + `event_type`. Reviewer noted "well-covered, no
action needed".

**Disposition:** ACCEPT.

## Implementation order

R4 (revoked=false guard — Critical) → R1 (timer cleanup) →
R2 (lastResult state) → R3 (4 missing BFF tests) → R5/R6/R7
(comments + tracing::warn).
