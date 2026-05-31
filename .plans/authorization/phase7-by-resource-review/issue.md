# Phase 7 by_resource — multi-review round 1

Date: 2026-05-31
Scope: realtime + filez `/api/access_policies/by_resource` endpoints,
authz-admin BFF `forwarder.rs` + `by_resource.rs` + `explain.rs` refactor,
SPA `ByResourcePanel` + `unwrapByResource`, and the regression tests
attached to each.

Reviewers: 4 parallel `Explore` agents (Security, Tech, QA, Slop).

## Findings — dispositions

Severity legend: ▲ Critical · ◆ Major · ○ Minor

### R1 — TOCTOU between owner check and policy fetch (SEC-1) ◆

The realtime + filez handlers each do an ownership check, then a policy
fetch in a separate query. If the resource's owner changes between
the two, the policy fetch uses a stale `resource_owner_id` for the
`OwnedByOwner` filter — the panel shows policies that no longer
match the current ownership.

Realistically the window is microseconds and neither realtime nor filez
ships a user-facing owner-transfer surface today, but the correct
fix is one line: run both queries inside a database transaction so
they share a snapshot.

**Disposition:** FIX. Wrap each handler's queries in
`diesel_async`'s `transaction` so the ownership-check + policy-fetch
run against one snapshot.

### R2 — Oversize-body cap not tested for by_resource (QA-1) ▲

`explain_rejects_oversize_body` covers the 16 KB cap for the explain
forwarder. Both endpoints share the same `read_bounded_body` helper
so the cap is enforced in one place, but the test only exercises
explain. A refactor that moved body-reading into a per-endpoint
layer would silently regress by_resource.

**Disposition:** FIX. Add `by_resource_rejects_oversize_body` mirroring
the explain test.

### R3 — Owner shortcut not asserted absent from `policies` array (QA-2) ▲

The realtime e2e test verifies the owner sees the team-a share policy
in the list, but doesn't assert the owner-shortcut is NOT also rendered
as a synthetic policy row. The product contract is: the SPA reads
`resource_owner_id` and renders a synthetic Owner row above the
policies; the backend must NOT include an Owner row in the policies
array (else the SPA double-renders).

**Disposition:** FIX. Add a negative assertion in the realtime e2e
test alongside the existing `team_a_share_pinned` check.

### R4 — Revoked + expired policies not tested (QA-4) ◆

Handler filters with `revoked = false` + expiration semantics
(mirroring the engine). No test verifies the filter — a regression
that drops it would silently render dead rows in the panel.

**Disposition:** FIX. Extend the realtime e2e test with a revoked-
policy scenario and assert it does NOT appear in the by_resource
result.

### R5 — SPA `unwrapByResource` doesn't type-validate `resource_owner_id` (TECH-6) ◆

The cast `(data.resource_owner_id as Uuid | null)` accepts any value
the upstream returns. If the upstream regresses and emits a number or
object, the cast silently succeeds and the table renders garbage.

**Disposition:** FIX. Add a `typeof === "string" || === null` guard.

### R6 — PoliciesTable React key fragility (TECH-7) ◆

`key={p.id}` becomes `undefined` if the upstream returns a policy
without an id, causing React to reuse DOM nodes across rows.

**Disposition:** FIX. Filter out policies with missing/invalid `id`
in `unwrapByResource` before they reach the table.

### R7 — Defensive `.expect()` on owner gate (TECH-1 / SLOP-7) ◆

`resource_owner_id.expect("owner gate proved Some above")` is correct
today but the invariant lives in the match-arm structure, not the
type system. A future variant addition could create a latent panic.

**Disposition:** FIX. Have each match arm bind the `Uuid` directly
(without the `Option` wrapper), removing the `.expect()` entirely.

### R8 — Unnecessary `Vec<Option<Uuid>>` allocation in filez (TECH-2 / SLOP-9) ◆

`group_ids.iter().map(|g| Some(*g)).collect::<Vec<_>>()` allocates a
temporary `Vec` to wrap each `Uuid` in `Some`. Diesel's `eq_any` can
take the borrowed `Vec<Uuid>` directly when the column is `Nullable<Uuid>`.

**Disposition:** FIX. Drop the map+collect; diesel handles the
nullable lift internally.

### R9 — BFF accepts free-form `resource_id` (TECH-4) ◆

The BFF takes `resource_id: String` and forwards it verbatim. An
invalid UUID becomes an upstream 500/parse-error instead of a clean
BFF 400 with a helpful message.

**Disposition:** FIX. Parse `resource_id` as `uuid::Uuid` at the BFF
deserializer; invalid input becomes a `BadRequest` with a clear
message before any upstream call.

### R10 — Stale docstring on `ExplainResponse.upstream_body` (SLOP-1) ◆

The docstring still describes the pre-R4 world ("realtime returns
`{evaluations}`, filez returns `{auth_evaluations}`"). After review-1
R4 both upstreams use the same shape.

**Disposition:** FIX. Update the docstring.

### R11 — Identity-header rationale missing from by_resource (SLOP-3) ○

`explain.rs` carries a paragraph explaining the SEC-2 / R2
anti-fingerprinting rationale at the `require_identity_header` call
site; `by_resource.rs` just calls the helper without the context.

**Disposition:** FIX. Add a single-sentence cross-reference comment
pointing at `forwarder.rs` for the rationale (avoid duplicating the
paragraph — both call sites stay slim, the helper carries the canon).

### R12 — Filez group-empty branch undocumented (SLOP-8) ○

`if !group_ids.is_empty()` correctly skips the group-policies fetch
for files with no memberships, but the comment doesn't say what the
expected behaviour is in that case.

**Disposition:** FIX. Add a one-line comment.

### R13 — Magic `"00000000-…-000000000000"` string in SPA (SLOP-6) ○

The nil-UUID literal appears inline in `formatSubjectId` for the
`Public` / `ServerMember` sentinel detection.

**Disposition:** FIX. Extract to a `NIL_UUID` constant at module scope.

### R14 — `payload === null && upstreamStatus !== 200` brittle (TECH-9) ○

The error-state condition couples payload nullability to HTTP status;
a future refactor that returns a non-null payload on 403 would silently
drop the error message.

**Disposition:** FIX. Decouple — always show the "upstream returned X"
line when status is non-200, then layer the owner/policies line on top
when payload is present.

### R15 — `resource_owner_id` nullability semantics drift (TECH-10) ○

Realtime's doc says "None for owner-less types"; filez's says "always
populated today". The wire-shape tests pin field names but not
nullability.

**Disposition:** FIX. Align the docstrings — both ship Some today,
both reserve None for future owner-less types. No code change needed.

### R16 — `ByResourcePolicy` TSDoc weak on optional fields (TECH-8) ○

`[extra: string]: unknown` permits anything but the comment doesn't
say which fields realtime vs filez actually emit.

**Disposition:** FIX. Add an @example to the docstring.

### Deferred (acknowledged, not blocking this round)

- **R-D1 (SLOP-5):** Hardcoded `UPSTREAM_DEFAULTS` / `BY_RESOURCE_DEFAULTS`
  — Phase 7 follow-up via `GET /api/upstreams/<key>/vocabulary`.
- **R-D2 (SLOP-2):** Further extraction of duplicated upstream-lookup
  logic in the two forwarders — accept the minor duplication this
  round; revisit when a third forwarder lands.
- **R-D3 (QA-3):** Multi-file-group filez integration test — needs the
  filez e2e DB rig that hasn't shipped yet (tracked under
  phase3-final-review D3 + phase4-review MIN-3).
- **R-D4 (QA-5):** SPA Vitest test for 403 render path — needs the
  authz-admin SPA's test rig (not yet wired).
- **R-D5 (TECH-3):** Single-query JOIN for filez group memberships
  + group policies — optimisation, not correctness.
- **R-D6 (SLOP-10):** Shared `wire_shape_guard` test harness — accept
  the duplication until a third consumer arrives.
- **R-D7 (SLOP-11):** Overlap between realtime e2e + BFF bff_forwarding
  tests — they exercise different stack layers; not actually
  duplication.

### Not actionable

- **R-N1 (TECH-5, SLOP-12):** Test-style notes about `panic!` vs
  `expect_err` — both idiomatic. No action.
- **R-N2 (SLOP-4):** Self-aware `_exhaustive` marker in api.ts — the
  pattern is correct; the comment just reflects honest engineering.

## Implementation order

R5 + R6 + R8 + R7 + R9 (engine + handler hardening, mechanical).
R1 (transaction wrapper).
R2 + R3 + R4 (test additions).
R10 + R11 + R12 + R13 + R14 + R15 + R16 (comments + small refactors).
