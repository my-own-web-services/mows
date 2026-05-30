# Multi-review — round 3 (B-fix verification)

4-perspective review (Security, Tech, QA, Slop) of commit
`b0a9aea6` — the 11 B-fixes that landed for review-2.

Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 0        | 0     | 1     |
| Tech        | 0        | 2     | 4     |
| QA          | 5        | 3     | 2     |
| Slop        | 0        | 2     | 4     |

After dedup: **7 actionable** items, **8 deferred / not-real**.

## Actionable

- **C1** ✅ — `mergeEvents` uses Map-insertion order
  (`[...current, ...incoming]`) which interleaves wrong under a
  lagged-reload scenario: a live WS event with `sent_at = T1`
  ends up in `current`; the subsequent `lagged`-triggered reload
  fetches older history (some with `sent_at < T1`) which gets
  appended *after* the newer T1 event. (TECH/REACT-1)
  **Fix:** sort the merged output by `sent_at` after dedup; both
  the current and incoming lists are individually chronological
  but their merge isn't.

- **C2** ✅ — `loadEnv(mode, process.cwd(), "")` loads **all**
  env vars (the empty third arg is a prefix filter). Wastes
  memory and risks leaking unrelated env vars into the config.
  (TECH/BUILD-1)
  **Fix:** pass `"VITE_"` as the prefix so only public-safe
  variables are loaded.

- **C3** ✅ — `MAX_EVENT_KIND_LEN = 64` is defined twice
  (publish.rs:33 + list.rs:27) with an inline comment in list.rs
  saying "Mirrors the cap on `publish`" — an explicit
  acknowledgement that the duplication is fragile.
  (TECH/SEC-1 + SLOP-2)
  **Fix:** extract to the shared `models/channels/events/mod.rs`
  module and import in both handlers.

- **C4** ✅ — `approx_json_size`'s "fail-open in the conservative
  direction" comment is internally contradictory: fail-open is
  liberal (lets bad input through), conservative is fail-closed
  (blocks bad input). The comment muddles the two. (SLOP-1)
  **Fix:** rewrite the comment to state the actual behaviour
  plainly: errors from a memory counter are unreachable in
  practice; on the impossible failure path the counter
  under-reports, axum's body cap is the backstop.

- **C5** ✅ — No regression tests for B8 (event_kind length cap)
  or B9 (payload size cap + null payload rejection). CLAUDE.md
  is strict: every fix must ship with a regression test.
  (QA-1, QA-2)
  **Fix:** extend `tests/end_to_end.rs` with three assertions:
  oversize `event_kind` query → 400, oversize payload → 400,
  null payload → 400.

- **C6** ✅ — Vite proxy target is unvalidated; a developer with
  `VITE_REALTIME_API_URL=http://attacker.com` in their shell
  would proxy auth headers (incl. the dev `X-Realtime-User-Id`)
  to that host. Dev-only risk but cheap to guard. (SEC-1)
  **Fix:** validate the parsed target hostname is `127.0.0.1` /
  `localhost` / `::1`; throw at vite-config load otherwise.
  Document escape hatch for non-trivial setups (e.g. staging) via
  a `VITE_REALTIME_API_URL_ALLOW_REMOTE=1` flag (off by default).

- **C7** ✅ — App.tsx's storage-event handler silently swallows
  corrupt JSON in the `known-users` mirror. The current branch
  is `catch { /* ignore */ }` with no log. Future debugging
  loses the trail. (SLOP-5)
  **Fix:** `console.warn` the corruption with the offending raw
  value so a developer hitting it has something to start from.

## Deferred

- **D1** ⁉️ — TECH/REACT-2 (ref-staleness window): the React
  effect order means `reloadHistoryRef.current = reloadHistory`
  fires *before* the subscription effect on every render, and
  the WS callback reads `.current` at call time (not closure
  time). The proposed race doesn't materialise.

- **D2** ⁉️ — TECH/TS-1 (`Error.captureStackTrace`): V8 already
  records the constructor stack for class-extends-Error; the
  explicit `captureStackTrace` call is an ES5/CommonJS-era
  pattern that's redundant on modern targets.

- **D3** ⁉️ — TECH/WEB-1 (`storageArea === null`): the HTML5
  spec requires storageArea to reference the storage object
  that changed for valid same-origin events. The null-fallback
  is folklore.

- **D4** ⁉️ — SLOP-3 (200 fetch vs 500 cap "mismatch"): the
  gap is deliberate — REST page is sized for first paint, the
  client buffer is sized to hold the page plus live additions
  plus lagged reloads without re-fetching. Not a bug.

- **D5** ⁉️ — SLOP-4 (`console.warn` → structured logger): no
  observability backend is wired in the chat app yet; flipping
  to a logger would just create dead infrastructure. When
  Sentry/DataDog land, this and SLOP-5's `console.warn` move
  together.

- **D6** ⁉️ — SLOP-6 (cap rationale expansion): the existing
  comments name the rationale (broadcast-buffer protection,
  realistic SDP/ICE/chat sizing). Expanding to threat models
  belongs in a top-level ARCHITECTURE.md§"Resource Limits"
  section, not in handler files.

- **D7** ⁉️ — QA-5 (chat app vitest infrastructure +
  component tests for B1-B7/B10-B11): same call as review-2/D10
  — landing vitest + RTL + msw scaffold is a ~1.5h infra
  investment best handled as a focused follow-up PR. The
  Rust-side regression tests (C5) cover the server contracts
  the chat app rides on; client behaviour is currently verified
  by browser smoke. Tracked for the next round.

- **D8** ⁉️ — QA-3/QA-10 (extract Ready-handshake test): the
  current `end_to_end_demo_flow` test asserts the Ready frame
  arrives + that publish-after-Ready reaches subscribers. A
  dedicated minimal test would be clearer but adds no
  regression-detection power.

## Action plan

Fix in this order:

1. C4 — comment polish (smallest)
2. C3 — extract `MAX_EVENT_KIND_LEN`
3. C2 — `loadEnv("VITE_")` prefix
4. C7 — storage corruption log
5. C6 — vite proxy localhost guard
6. C1 — `mergeEvents` chronological sort
7. C5 — Rust regression tests for B8 / B9 / null payload
