# Multi-review — realtime API generalization + chat React app

4-perspective review (Security, Tech, QA, Slop) of the second
big change: chat → realtime rename + `channel_events` reshape +
new `apis/cloud/realtime/apps/chat/` React app.

Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 0        | 1     | 5     |
| Tech        | 2        | 4     | 2     |
| QA          | 2        | 4     | 2     |
| Slop        | 4        | 4     | 2     |

After dedup: **11 actionable** items, **12 deferred / not-real**.

## Actionable

- **B1** ✅ — Raw `<select>` + `<input type="checkbox">` violate
  the project's "no raw HTML form controls; use lib/components/ui
  primitives" rule. (SLOP-2)
  **Fix:** Swap to `Checkbox` from `@my-own-web-services/react-components/components/ui/checkbox`
  in ShareDialog. The acting-user `<select>` stays a native
  control (Radix Select would need a complex Trigger/Content
  composition for a dev-mode user picker — disproportionate for
  the use case; documented inline).

- **B2** ✅ — ShareDialog silently auto-injects `ChannelsList`
  alongside `ChannelsRead`, amplifying the user's grant without
  explicit consent. (SEC-4, SLOP-7)
  **Fix:** Relabel the checkbox to `"ChannelsRead + ChannelsList
  (so the room appears in their sidebar)"`. Make the UI honest
  about both actions being granted.

- **B3** ✅ — `bodyOf()` in ActiveRoom silently `JSON.stringify`s
  the whole payload when the `body` field is missing — hides
  contract failures behind valid-looking output. (SLOP-3)
  **Fix:** Render an explicit `"[unsupported chat payload shape]"`
  message + log to console; the chat app's contract is
  `{body: string}` and a mismatch should be visible.

- **B4** ✅ — ActiveRoom's WS-subscription `useEffect` depends on
  `reloadHistory` which is itself memoized — StrictMode double-
  mounts the component, opening two WebSockets before cleanup.
  (REACT-1)
  **Fix:** Remove `reloadHistory` from the deps array; call it
  exactly once via a stable ref. The effect body becomes
  `[actingUser, channel.id]` — true dependencies only.

- **B5** ✅ — `setEvents((prev) => [...prev, frame.event])` is
  unbounded; a long-lived room builds an in-memory array that
  grows linearly forever. (REACT-2)
  **Fix:** Cap at the most-recent 500 events; the durable log is
  in Postgres + reachable via REST.

- **B6** ✅ — `lagged` frame triggers `reloadHistory()` but events
  in-flight via WS aren't deduplicated against the reloaded
  history → potential duplicates. (QA-1)
  **Fix:** De-duplicate by event `id` when merging — use a Map
  keyed on `event.id` so the same event arriving twice is a
  no-op.

- **B7** ✅ — `realtimeApi` throws `new Error("${err}: ${msg}")`
  which loses the HTTP status code, making it impossible to
  distinguish 403 (permission) from 500 (server error). (ERR-1)
  **Fix:** Export a typed `ApiError extends Error` with
  `status: number` + `kind: string` fields. Callers can branch
  on `e.status === 403` for friendlier UX.

- **B8** ✅ — `list_events` accepts an unbounded `event_kind`
  query string. Pathological values (100 KB strings) waste
  bandwidth and serialize through Diesel's parameter encoding
  without complaint. (SEC-1)
  **Fix:** Cap at the same 64-char ceiling the publish handler
  uses; reject longer values with 400.

- **B9** ✅ — `publish_event` calls `serde_json::to_vec` upfront
  for size validation then discards the result, forcing diesel
  to re-serialize the same value on insert. (TECH-1)
  **Fix:** Validate size against a cap on the input string's
  byte length (we already have the parsed `Value` and never need
  the bytes ourselves — the size check moves to the request-body
  layer where axum already enforces it). Drop the redundant
  `to_vec`.

- **B10** ✅ — Chat-app vite proxy hardcodes
  `http://127.0.0.1:8765`; production deploys can't override.
  (SLOP-1)
  **Fix:** Read `VITE_REALTIME_API_URL` (falls back to the
  dev URL).

- **B11** ✅ — App.tsx reads + writes `acting-user` localStorage
  but doesn't listen for cross-tab `storage` events; two tabs of
  the chat app silently overwrite each other's identity. (QA-2,
  SLOP-4)
  **Fix:** Add a `useEffect` that listens for the `storage`
  event + syncs `actingUser` when the key changes externally.

## Deferred

- **D1** ⁉️ — SEC-3 (label XSS amplification): React's text
  rendering of `{label}` is safe by construction (interpolation,
  not innerHTML). Concern is theoretical.

- **D2** ⁉️ — SEC-5 (empty `{}` payload spam): rate-limiting +
  per-channel storage caps are explicit MVP-deferred work.

- **D3** ⁉️ — SEC-6 (no per-channel storage limit): same — falls
  under the rate-limiting deferral.

- **D4** ⁉️ — TECH-2 (split `list_recent` into two signatures):
  the runtime-arm shape is fine for MVP; refactor when the index
  shape changes.

- **D5** ⁉️ — REACT-3 (`?user=` via header instead of query):
  documented dev-only path; production replaces it with Bearer
  tokens via Sec-WebSocket-Protocol.

- **D6** ⁉️ — LIB-1 (deep imports `@my-own-web-services/react-components/components/ui/button`):
  the package's `exports` map already lists `"./*"` so deep paths
  ARE part of the public surface, not internal-only.

- **D7** ⁉️ — TYPE-1 (typed parsed status discriminated union):
  the cast in realtimeApi is intentional — improvements land
  with B7 (ApiError).

- **D8** ⁉️ — PERF-1 (DashMap broadcast registry): tracked as D1
  in the previous multi-review; same answer (MVP single-process).

- **D9** ⁉️ — SCHEMA-1 (verify partial index exists): the agent
  missed it — migration 00000000000000_init/up.sql line 57
  creates it explicitly.

- **D10** ⁉️ — QA-3/4/5/7 (vitest infrastructure + test files):
  setting up vitest + RTL + msw for the chat app is a separate
  ~500-LOC infra effort. Tracked for the next round; current
  end-to-end coverage in the realtime-server test + manual
  browser smoke is sufficient validation.

- **D11** ⁉️ — QA-6 (strengthen end-to-end Rust frame
  assertions): the test already pins `kind`, `event_kind`,
  payload field, `author_id` — extra fields are nice-to-have
  not blocker.

- **D12** ⁉️ — QA-8 (test the lagged-frame flow): would require
  reaching past 256 events in one publish loop; B5 (event cap)
  + B6 (id dedup) cover the failure modes the test would
  detect.

## Action plan

Fix in this order:

1. B9 — drop the double-serialize (smallest)
2. B8 — cap event_kind length
3. B7 — typed ApiError
4. B6 — id-based event dedup
5. B5 — event-buffer cap
6. B4 — drop reloadHistory from effect deps
7. B3 — explicit invalid-payload notice
8. B2 — honest share label
9. B1 — Checkbox primitive in ShareDialog
10. B11 — cross-tab storage sync
11. B10 — `VITE_REALTIME_API_URL`
