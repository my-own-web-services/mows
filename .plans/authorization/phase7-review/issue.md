# Multi-review — Phase 7 authz-admin slice

4-perspective review (Security / Tech / QA / Slop) of the
authz-admin BFF, the per-consumer explain endpoints, and the
React SPA. QA still pending at time of writing; this doc updates
as findings arrive.

Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 1        | 1     | 1     |
| Tech        | 6        | 7     | 5     |
| Slop        | 3        | 4     | 3     |
| QA          | 1        | 2     | 4     |

After dedup: **13 actionable** items addressed in this round.

## Actionable

- **R1** ✅ — CORS `mirror_request()` combined with
  `allow_credentials(true)` and `Any` headers is unsafe: the
  browser is told "yes, this response is safe for the
  attacker's origin to read with credentials." (SEC-1)
  **Fix:** drop `allow_credentials(true)` — the BFF doesn't
  use cookies and the React SPA doesn't send credentialed
  cross-origin requests. Keep `mirror_request()` for the
  per-subdomain admin UI use case; the absence of credentials
  closes the leak.

- **R2** ✅ — BFF forwards anonymous explain requests
  unchanged. If the upstream's auth middleware ever
  regressed to "missing header → 200 + empty evaluations,"
  an unauthenticated caller could fingerprint resource ids
  by walking the upstream's vocabulary. (SEC-2)
  **Fix:** the BFF refuses `/api/access_policies/explain`
  with 401 unless at least one identity header is present
  (`Authorization`, `x-realtime-user-id`, `x-filez-user-id`).
  Integration test covers the rejection path.

- **R3** ✅ — Upstream base URLs not validated; a misconfigured
  `REALTIME_BASE_URL=http://169.254.169.254/` would turn the
  BFF into an SSRF probe into cluster metadata. (SEC-3)
  **Fix:** `Registry::from_config` parses each URL and
  refuses anything that isn't HTTPS, localhost / 127.0.0.1 /
  ::1, or a private RFC1918 range (typical k8s service IPs).
  Boot fails loudly on a misconfigured URL.

- **R4** ✅ — Realtime returns `{evaluations}` + accepts
  `{resource_type, action}`; filez returns `{auth_evaluations}` +
  accepts `{access_policy_resource_type, access_policy_action}`.
  The drift forced the BFF into a schema translator (`match
  upstream`) and pushed an `unwrapEvaluations` helper into the
  SPA. (TECH-15, SLOP-5/6, TECH-11)
  **Fix:** standardize both endpoints on the shorter realtime
  shape (`{resource_type, action}` request / `{evaluations}`
  response). Filez's `ExplainAccessRequestBody` /
  `ExplainAccessResponseBody` fields renamed; openapi + TS
  client regenerated. BFF forwards request + response
  verbatim — no per-upstream `match` left. SPA drops
  `unwrapEvaluations` and reads `data.evaluations` directly.

- **R5** ✅ — Per-upstream request-body adapter lived in
  `http_api/explain.rs` and matched on `"realtime"` / `"filez"`
  string literals at request time. A third consumer added to the
  registry without a matching adapter case would fail every
  forwarded call. (TECH-3)
  **Fix:** subsumed by R4 — after standardising field names
  there is no adapter to register. The forwarder hands the
  caller's request body through verbatim, the BFF stays
  stateless about per-upstream vocabulary.

- **R6** ✅ — `App.tsx`'s upstreams effect carries `refreshUpstreams`
  in its dependency array. Currently stable because
  `refreshUpstreams` is a `useCallback` with `[]` deps, but a
  future refactor that adds a dep would silently introduce a
  render loop (refetch every render). (TECH-7)
  **Fix:** call via a stable ref (same pattern review-3 C5
  applied to `ActiveRoom`'s `reloadHistory`). Effect deps
  become `[]` — the true semantic dependency.

- **R7** ✅ — `EvaluationsTable` keys rows on
  `(ev.resource_id ?? "type-level") + i`. Two type-level rows
  collide on the index-suffixed key, breaking React
  reconciliation (stale focus / input state across rerenders).
  (TECH-9)
  **Fix:** prefer the `policy_id` from `reason` when available
  (every non-Owner / non-anonymous variant carries one), fall
  back to `resource_id + index` only as a last resort. Same
  helper also lets the row click into a detail view later.

- **R8** ✅ — `AuthReason` TypeScript type is hand-mirrored from
  `mows_auth_core::AuthReason`; a new Rust variant would render
  as `"Unknown"` in `authReasonLabel` without any compile-time
  signal. (TECH-12, SLOP-4)
  **Fix:** add an exhaustiveness assertion in `authReasonLabel`
  via the `_exhaustive: never` pattern so an unknown variant
  becomes a TypeScript error at the next build (catches drift
  the next time anyone touches the file). Codegen from openapi
  is the proper fix — tracked as a follow-up in the file's
  module comment.

- **R9** ✅ — Comments in `http_api/explain.rs` restate the WHAT
  not the WHY of the header whitelist (e.g. `"Whitelist rather
  than passthrough-all to avoid leaking BFF-internal headers"`
  → vague; an explicit example was missing). (SLOP-9)
  **Fix:** comment now names the concrete risk (routing
  cookies / traefik metadata) so a reader knows it's a
  security decision, not cargo-cult.

- **R10** ✅ — Filez `/api/access_policies/explain` had no
  integration test; only a manual smoke verified it worked.
  (QA-1)
  **Fix:** added `tests/explain_integration.rs` covering
  three scenarios — owner shortcut (`Owned` reason), no-policy
  empty result, and missing-field 400.

- **R11** ✅ — BFF integration tests covered the happy + bad-
  upstream-key paths but missed: upstream returning 401 (must
  surface `upstream_status=401` to the SPA), missing required
  field (must 400 cleanly), and oversize body. (QA-3, QA-4
  partial)
  **Fix:** three new `#[tokio::test]` functions in
  `bff_forwarding.rs`. The non-whitelist-header check + the
  missing-identity check are covered by R2's identity-header
  guard test.

- **R12** ✅ — Round 7 explain assertions in
  `realtime-server/tests/end_to_end.rs` cover the positive
  paths (Owned, AllowedByDirectUserGroupPolicy, empty) but
  don't pin the *absence* of leakage. If a regression made
  every user see every channel as Owned, only the explicit
  positive assertions would fail — the test wouldn't catch a
  silent over-exposure. (QA-5)
  **Fix:** explicit negative assertion — Carol's explain
  evaluations must not contain the team-room channel id, AND
  Bob's reason on team-room must NOT be `"Owned"` (catches a
  regression where the owner shortcut over-fires).

## Deferred

- **D1** ⁉️ — TECH-1/2 (clones in upstreams.rs probe + missing
  `tracing::instrument`): `reqwest::Client` is Arc-backed so
  the clone is `Arc::clone` cost; `TraceLayer` already produces
  per-request spans for the handler. Not worth churn for
  marginal gain.

- **D2** ⁉️ — TECH-5 (split `reqwest::Error` into typed
  variants): the BFF returns the failure verbatim under
  `upstream_status` already; the SPA renders it. Splitting
  client-side variants adds API surface without changing what
  an operator sees.

- **D3** ⁉️ — TECH-6 (50ms sleep in `spawn_mock_upstream`):
  bind happens synchronously inside `tokio::net::TcpListener::bind`
  before the spawn; the sleep is belt-and-braces. Tests run
  in <200 ms on CI today.

- **D4** ⁉️ — TECH-10 (type bypass in `ReasonDetail`): the
  cast `Object.values(reason)[0] as Record<string, string>` is
  bounded by the AuthReason variants we know about; future
  drift is gated by R8's exhaustiveness check.

- **D5** ⁉️ — TECH-13/14 (header validation, non-JSON error
  body): dev-only path; production replaces the dev headers
  with a Bearer flow which goes through a different code
  path.

- **D6** ⁉️ — TECH-16/17, SLOP-2/3 (dynamic per-upstream
  vocabulary endpoint): real fix, but a follow-up commit
  (probably one new endpoint per consumer + matching SPA
  hydration). Acknowledged in inline comments + the README
  next-steps list.

- **D7** ⁉️ — TECH-18 (document two-step list+check in the
  upstream): the existing comments already explain it; no
  change.

- **D8** ⁉️ — SLOP-7 (openapi drift CI check): filez has it;
  authz-admin should grow it when the api-client codegen
  lands. Tracked under follow-up.

- **D9** ⁉️ — SLOP-8 (localStorage key naming convention):
  cluster-wide, not Phase-7-specific. Belongs to a
  cross-cutting cleanup pass.

- **D10** ⁉️ — SLOP-10 (codegen-trigger TODO): the README
  next-steps list already names it; no action needed.

## Action plan

Fix order:

1. R4 — standardise realtime + filez explain field names
   (the big one — cascades into R5 and R7)
2. R5 — already collapses into R4
3. R1 — drop `allow_credentials(true)` from the CORS layer
4. R3 — validate upstream URLs at boot
5. R2 — BFF identity-header guard + integration test
6. R6 — ref-stable `refreshUpstreams` in App.tsx
7. R7 — better key on EvaluationsTable rows
8. R8 — exhaustiveness assert on `authReasonLabel`
9. R9 — comment polish
