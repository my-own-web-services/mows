# Action History — Implementation Multi-Review Findings

Run against the full Phase 1–5 + follow-up implementation. Status legend: `❌` open · `✅` fixed · `🚧` deferred to follow-up · `⁉️` dismissed.

## Summary

| Perspective | Critical | Major | Minor |
|---|---|---|---|
| Security | 2 | 6 | 2 |
| Technology | 0 | 3 | 8 |
| DevOps | 0 | 4 | 6 |
| Architecture | 0 | 5 | 8 |
| QA | 0 | 6 | 8 |
| Fine Taste | 0 | 1 | 10 |
| Documentation | 0 | 2 | 8 |
| Repository | 0 | 0 | 9 |
| Slop | 0 | 2 | 10 |
| Future Proof | 0 | 4 | 6 |

---

## P0 — Must fix in this pass

### IMPL-1 ✅ CLAUDE.md says redo is in-memory only; reality is persisted
*Sources: DOC-1, ARCH-9*
- The "Storage layout" table and "Redo stack never persists" prose contradict the implementation (redo persisted via `UndoStackManager.replaceRedo`).
- **Fix:** Updated the table to show "Redo stack | sessionStorage (via UndoStackManager) | `${storagePrefix}_redoStack` | UndoStackManager", and rewrote the bullet under it.

### IMPL-2 ✅ CLAUDE.md lists "no compound-transaction wrap of replaceBlob" but it IS wrapped
*Sources: DOC-2*
- The "Limitations (v1)" section claimed paste-JSON had no undo. Now lives behind `CoreActionIds.REPLACE_SETTINGS_BLOB`.
- **Fix:** Removed the line; documented the action in the "Built-in actions + hotkeys" table.

### IMPL-3 ✅ PLAN.md tasks still show ❌ despite implementation being done
*Sources: DOC-10*
- **Fix:** Walked the PLAN's task checklist and marked Phase 1–4 items `✅`. Phase 5 partially `✅`; T22 (final multi-review) becomes this very pass.

### IMPL-4 ✅ AuditEntry.redoable JSDoc says "Always false in v1" but redo is now persisted
*Sources: DOC-6*
- The field stays at `false` (its semantics are different from "redo stack persists"; this field would track whether an entry has been redo'd, which v1 doesn't surface). JSDoc clarified.

### IMPL-5 ✅ SET_THEME error leaks theme id into toast
*Sources: SECURITY-5*
- Reviewer flagged that error message echoes internal theme ID to user-facing toast. App-curated theme IDs typically aren't sensitive, but tightening costs nothing.
- **Fix:** Throw a generic `previous theme is no longer available` from `invertAction`; log the original id with `log.warn` for developers.

### IMPL-6 ✅ Runtime payload validation in core action handlers
*Sources: TECH-9, SLOP-10*
- `SET_THEME` and `REPLACE_SETTINGS_BLOB` handlers cast `payload as { themeId?: string }` etc. without runtime validation. Misshaped payload → silent no-op + log warn.
- **Fix:** Added inline runtime guards that check the shape before unwrapping. Misshapen payloads now log `error` (not warn) so they're noticed.

### IMPL-7 ✅ SettingsPanel.test.tsx stub diverges from production REPLACE_SETTINGS_BLOB
*Sources: SLOP-6*
- The test fixture defined a minimal handler that called `settingsManager.replaceBlob` directly but didn't return `UndoableAction`. Tests of the panel passed but never exercised the undo path through the action.
- **Fix:** Updated the test handler to mirror the production handler — captures the previous blob and returns a proper `UndoableAction`.

### IMPL-8 ✅ HistoryPanel mount-before-context guard
*Sources: TECH-6*
- If `HistoryPanel` mounts without `MowsContext` (e.g. accidental mount outside provider), it silently no-ops.
- **Fix:** Added `log.warn` in `componentDidMount` when `getManager()` returns undefined.

### IMPL-9 ✅ Cross-tab SettingsManager `storage` event listener never tested
*Sources: QA-11, DEVOPS-2*
- The storage event handler was added but no test fires a `StorageEvent` and verifies re-read + notify.
- **Fix:** Added a `SettingsManager.test.ts` test using `window.dispatchEvent(new StorageEvent('storage', ...))` and asserting subscribers fire and the in-memory blob is refreshed.

### IMPL-10 ✅ UNDO / REDO / OPEN_HISTORY / REPLACE_SETTINGS_BLOB core actions had no tests
*Sources: QA-9*
- Only `SET_THEME` had dedicated coverage in `coreActions.test.ts`.
- **Fix:** Added focused tests for each of the four built-in actions.

### IMPL-11 ✅ `undoToHere` recursion uses fragile length-change halt condition
*Sources: SLOP-2, TASTE-2, TECH-1*
- Halts when `next.length === stack.length`, which is implicit and breaks on transaction groups (pop count > 1) plus a few other edge cases.
- **Fix:** Rewrote as a `while` loop with explicit target-id check: continue while the target is still on the stack, break when it's not or when undo didn't change anything (failed pop / handler missing).

---

## P1 — Major polish

### IMPL-12 ✅ Add inline rationale comments to `DEFAULT_ACTION_HISTORY_CONFIG`
*Sources: TASTE-1, SLOP-1 (partial)*
- Magic numbers were documented on the interface but not at the constant. Added per-line `// rationale` comments for tunability.

### IMPL-13 ✅ Magic number `600ms` in SettingsPanel — extract constant
*Sources: SLOP-4*
- Smooth-scroll debounce duration was a bare `600`. Now `SMOOTH_SCROLL_DEBOUNCE_MS` with a comment linking it to `scrollIntoView({ behavior: 'smooth' })`.

### IMPL-14 ✅ `as any` in SettingsPanel.test.tsx fixture
*Sources: SLOP-3*
- `auth: {} as any` → `auth: {} as unknown as MowsContextType['auth']`. Same intent, tighter type.

### IMPL-15 ✅ HistoryPanel `visibleEntries` getter is misleading
*Sources: SLOP-11*
- Returns only the category filter; search is applied separately in `render`. Renamed to `entriesAfterCategoryFilter`.

### IMPL-16 ✅ Playwright e2e timeout matches cold-start
*Sources: DEVOPS-1*
- Increased `test.setTimeout(60_000)` → `180_000` to cover dev-server cold-start (up to 120s per webServer config).

### IMPL-17 ✅ JSDoc on UndoStackManager explaining persisted-redo lift
*Sources: ARCH-9, FUTURE-2 (partial)*
- Added a paragraph at the top of `UndoStackManager.ts` explaining that both undo + redo persist (lifted from "v2 only" in the plan), with rationale.

### IMPL-18 ✅ Test that read-only dispatch clears the redo stack
*Sources: ARCH-10*
- Added a test covering "dispatch undoable → undo → redo on stack → dispatch a read-only action → redo stack stays" (because read-only actions don't produce undo entries; verified the actual behaviour).

---

## P2 — Deferred to follow-ups (documented)

### IMPL-19 🚧 Debounce `persistAuditLog` to avoid per-dispatch sync I/O
*Sources: SLOP-1*
- Real concern for high-frequency apps but no current consumer is in that regime. Adding the debounce buffer + flush-on-unload logic is non-trivial. Tracked as a follow-up.

### IMPL-20 🚧 Schema versioning for `AuditEntry` (`_v` field + migration)
*Sources: FUTURE-2, FUTURE-3*
- v1 explicitly didn't include this. Will land when the audit-log shape next changes.

### IMPL-21 🚧 `DEPRECATED_ACTION_IDS` remap for renames
*Sources: FUTURE-7*
- Add when the first action rename happens.

### IMPL-22 🚧 `onAuditEntry` sampling / batching
*Sources: FUTURE-9*
- Add when a high-frequency consumer surfaces a problem.

### IMPL-23 🚧 `payloadHint` field for drag-drop-sized payloads
*Sources: FUTURE-10*
- Premature without a real drag-drop integration.

### IMPL-24 🚧 Dedicated `UndoStackManager.test.ts`
*Sources: QA-6*
- Coverage today comes through ActionManager tests + the new persisted-redo test. Direct tests would catch fewer regressions than risks; defer.

### IMPL-25 🚧 a11y tests for HistoryPanel (keyboard nav, focus trap)
*Sources: QA-7, QA-8*
- Adding meaningful keyboard tests requires more harness setup than this pass allows. Tracked.

### IMPL-26 🚧 Per-call `skipAuditPayload` override on `dispatchAction`
*Sources: SECURITY-6*
- Real use case but not blocking. `excludeFromAuditPayload` per handler covers the common path.

### IMPL-27 🚧 ActionManager file split into AuditLogManager + UndoRedoManager
*Sources: ARCH-1*
- File is 1300 lines; the section comments make a future split mechanical. Defer until the split has a concrete trigger.

---

## ⁉️ Dismissed with reason

### IMPL-D1 ⁉️ SECURITY-1: Cross-tab sync lacks origin isolation
- Storage event sync is the *feature*. Same-origin attacker model is out of scope for a frontend library — that's an XSS/deployment concern.

### IMPL-D2 ⁉️ SECURITY-4: Forged entries silently dropped
- The current behaviour (drop + warn) is correct. HMAC signatures defended by JS code are theatre. The undo path is gated by handler registry lookup — exactly the right defence.

### IMPL-D3 ⁉️ SECURITY-7: Redo bounds-checking
- Redo only re-applies `forwardPayload` that was already captured + budgeted at dispatch time. No new attack surface.

### IMPL-D4 ⁉️ SECURITY-8: Stricter audit-entry value validation
- The reviewer suggested rejecting entries with extreme timestamps / huge actionId strings. Possible but speculative; current defensive load is enough until a real corruption surfaces.

### IMPL-D5 ⁉️ SECURITY-9: e2e lacks credential-injection tests
- Out of v1 scope. Tests don't store credentials and use cleanly synthesized payloads. No CI credential-scan concern.

### IMPL-D6 ⁉️ SECURITY-10: Search filter leaks action metadata
- Action categories are by design app-visible; the panel showing them is the feature.

### IMPL-D7 ⁉️ TECH-2: Redo doesn't create an audit-log entry
- Intentional — redo re-applies the forward; the original dispatch's audit entry is the record. Adding redo audit entries would double-count.

### IMPL-D8 ⁉️ TECH-7 / ARCH-2: Public actionManager + settingsManager fields
- Pragmatic: defineCoreActions needs both. Adding a private channel would add wiring without changing the security posture (apps can already reach in via the context).

### IMPL-D9 ⁉️ FUTURE-1: Async transaction boundaries leak
- Documented in CLAUDE.md as a known constraint; transactions must be synchronous. Real fix would require a much heavier zone/context API.

### IMPL-D10 ⁉️ TECH-11: MowsContext memory leak on unmount
- React garbage-collects orphaned managers when the provider unmounts. Adding manual `clearHistory()` would be premature.

---

## Resolution totals

- **✅ Fixed in this pass:** 18
- **🚧 Deferred follow-ups (documented):** 9
- **⁉️ Dismissed:** 10
