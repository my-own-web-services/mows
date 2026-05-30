# Settings System — Multi-Review Findings

Status legend: ❌ open · ✅ fixed · ⁉️ dismissed (with reason)

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 0        | 0     | 0     |
| Technology    | 1        | 4     | 5     |
| DevOps        | 2        | 4     | 4     |
| Architecture  | 3        | 4     | 5     |
| QA            | 3        | 8     | 4     |
| Fine Taste    | 0        | 1     | 4     |
| Documentation | 0        | 0     | 0     |
| Repository    | 0        | 0     | 2     |
| Slop          | 0        | 2     | 5     |
| Future Proof  | 1        | 3     | 4     |

Findings consolidated to one entry per real issue; status appended after each fix.

---

## P1 — Major correctness / architecture

### ISSUE-1 ✅ Redundant if/else in syncStateFromBlob
*Sources: ARCH-1, TECH-2, SLOP-1, TASTE-2*
- **File:** `lib/lib/mowsContext/MowsContext.tsx`
- **Fix:** Removed the dead conditional; unconditionally calls `applyThemeClassSynchronously(nextTheme)` with a comment explaining why (system theme can change resolved class without changing id).

### ISSUE-2 ✅ `forceUpdate()` is a React smell
*Sources: TECH-4, SLOP-2*
- **File:** `lib/lib/mowsContext/MowsContext.tsx`
- **Fix:** `appSettingsContext` moved into `MowsClientManagerState`. `componentDidUpdate` now calls `setState({ appSettingsContext: … })`, so React schedules a normal render — no `forceUpdate` bypass.

### ISSUE-3 ✅ `_v` version validation belongs in the manager, not the panel
*Sources: ARCH-2, ARCH-11, DEVOPS-6, FUTURE-1, FUTURE-2, SLOP-6*
- **Files:** `lib/lib/mowsContext/SettingsManager.ts`, `lib/components/settings/settingsPanel/SettingsPanel.tsx`
- **Fix:** New `validateBlob()` pure-function gate + `SettingsBlobValidationError`. Called by `readBlob`, `replaceBlob`, and the `initialBlob` constructor path. SettingsPanel just forwards parsed JSON to `replaceBlob` and catches the typed error.

### ISSUE-4 ✅ Move device-local state out of `core`
*Source: FUTURE-3*
- **Files:** `SettingsManager.ts`, `legacyMigration.ts`, `MowsContext.tsx`, tests
- **Fix:** New `device` slot (sibling to `core`/`app`). `recentActions` + `hotkeyConfig` now live in `device.*`. New `deviceSlotAdapter` used by ActionManager/HotkeyManager. Migration writes legacy hotkey/recent values into `device`. CLAUDE.md + guide updated.

### ISSUE-5 ✅ Multi-tenant: writes can target other apps' slots
*Sources: FUTURE-5, ARCH-4, SLOP-4*
- **File:** `lib/lib/mowsContext/appSettings.ts`
- **Fix:** `createAppSettingsContextValue(_, null)` now throws on `setValue` (catches the "forgot to pass `appSettings`" wiring bug). Reads return `undefined` so SettingsPanel can still render its core sections for apps with no per-app settings. `__unregistered__` sentinel gone.

### ISSUE-6 ✅ ActionManager / HotkeyManager config = discriminated union
*Source: DEVOPS-9, ARCH-6*
- **Files:** `ActionManager.tsx`, `HotkeyManager.tsx`
- **Fix:** Config types are now `({slot} | {storageKey})` discriminated unions; runtime check in the resolver throws on the impossible "both provided" case.

### ISSUE-7 ✅ Listener loop survives mutation + exceptions
*Sources: QA-3, QA-4*
- **File:** `SettingsManager.ts`
- **Fix:** New `fireBucket` helper iterates a `snapshot = Array.from(bucket)` and wraps each call in try/catch + `log.error`. A subscriber that throws / unsubscribes itself can no longer break the cycle or block persistence. Covered by two new tests.

### ISSUE-8 ✅ persistNow surfaces storage errors
*Sources: TECH-9, QA-5*
- **File:** `SettingsManager.ts`
- **Fix:** Added optional `onPersistError(error)` callback in the manager config. Defaults to `log.warn`. Covered by a quota-error test.

### ISSUE-9 ✅ setLanguage in-flight race
*Source: TECH-6*
- **File:** `MowsContext.tsx`
- **Fix:** Added `pendingLanguageCode` ref. Resolution of a stale `import()` is dropped if a newer pick already won.

### ISSUE-10 ✅ Export → import integration test
*Source: QA-10*
- **File:** `lib/components/settings/settingsPanel/SettingsPanel.test.tsx`
- **Fix:** New "export → import round-trip" test seeds a manager, grabs the JSON-tab text, unmounts, mounts a fresh manager, pastes, saves, asserts blob equality.

### ISSUE-11 ⁉️ createAppSettingsContextValue manager-identity rebind
*Source: ARCH-8*
- **Reason:** No code path in the lib ever swaps the manager instance — the class-component owns it for its lifetime. The agent flagged a hypothetical refactor. Adding the rebind would be speculative complexity; ISSUE-26 already warns against the related foot-gun (swapping `appSettings`).

### ISSUE-12 ✅ useMowsContextSafe re-throws non-provider errors
*Sources: TECH-3, ARCH-7, SLOP-3*
- **File:** `useAppSetting.ts`
- **Fix:** Catches only the known "useMows must be used within a MowsProvider" marker; any other error is re-thrown so real bugs surface.

### ISSUE-13 ✅ JSON tab preserves in-progress edits
*Source: ARCH-9*
- **File:** `lib/components/settings/settingsPanel/SettingsPanel.tsx`
- **Fix:** Added `jsonTextareaRef`; the blob→draft sync `useEffect` skips when the textarea (or any child) holds `document.activeElement`.

---

## P2 — Test coverage gaps

### ISSUE-14 ✅ QA-1: Subscribe to non-existent path test
*`SettingsManager.test.ts` → "subscribing to a path that doesn't exist yet fires on first write"*

### ISSUE-15 ✅ QA-2: Idempotent writes skip persist + notify
*`SettingsManager.test.ts` → "identical writes skip persistence AND notification"*

### ISSUE-16 ✅ QA-6: New + legacy keys present → no-op
*`legacyMigration.test.ts` → "new unified key wins even when legacy keys are also present"*

### ISSUE-17 ✅ QA-7: removeItem throws → migration still completes
*`legacyMigration.test.ts` → "completes migration even when removeItem throws on one key"*

### ISSUE-18 ✅ QA-8: Malformed JSON-shape legacy values
*`legacyMigration.test.ts` → "skips JSON-but-wrong-shape legacy values (null, array, primitive)"*

### ISSUE-19 ⁉️ QA-11: Wildcard/prefix subscription semantics
*Already covered by the existing "fires wildcard subscribers on every change" + "notifies ancestor-path subscribers too" tests. Adding a third "prefix-glob" test would be redundant.*

### ISSUE-20 ✅ QA-12: Custom render escape hatch test
*`SettingsPanel.test.tsx` → "app-settings custom render escape hatch: receives value + setValue"*

### ISSUE-21 ✅ QA-13: Group label slug stability for special characters
*`SettingsPanel.test.tsx` → "app-settings group label slugs are stable across special characters"*

### ISSUE-22 ✅ QA-14: React-level `useAppSetting` test
*New file `useAppSetting.test.tsx` with 5 tests: default fallback, type-guard fallback, external-write re-render, unknown-key throw, schema-mismatch throw.*

---

## P3 — Cleanups

### ISSUE-23 ✅ JSDoc parity in `de/default.ts`
- **File:** `lib/lib/languages/de/default.ts`
- **Fix:** Added the matching JSDoc above `appSectionDefaultGroup` (DE).

### ISSUE-24 ✅ Inline single-field `buildAuxKeys`
*Source: REPO-2*
- **File:** `MowsContext.tsx`
- **Fix:** Replaced with a constant `POST_LOGIN_REDIRECT_PATH_SUFFIX` + a single instance field `postLoginRedirectKey`.

### ISSUE-25 ✅ Expand the `renderFn` cast comment
*Source: SLOP-5*
- **File:** `SettingsPanel.tsx`
- **Fix:** Comment now explains the covariance/contravariance reasoning and where runtime safety comes from (`matchesFieldType` filter applied one closure earlier).

### ISSUE-26 ✅ Document `appSettings` prop must not be swapped mid-life
*Source: TECH-8, DEVOPS-4*
- **File:** `MowsContext.tsx`
- **Fix:** Extended the `appSettings` prop JSDoc — "pass a stable reference … swapping at runtime works but orphans previously-stored values under the old `appKey`."

### ISSUE-27 ⁉️ Defensive section-id slug normalization
*Source: ARCH-13 — partly covered by ISSUE-21. The existing `slugForGroup` is already defensive.*

### ISSUE-28 ✅ Settings System section in CLAUDE.md
*Source: DEVOPS-10*
- **File:** `components/react/CLAUDE.md`
- **Fix:** New section covering the blob layout (`_v` / `core` / `device` / `app`), the source files, and the rule against bypassing the manager.

### ISSUE-29 ⁉️ Move settings files into `mowsContext/settings/` subfolder
*Source: REPO-1*
- **Reason:** `lib/lib/mowsContext/` is the lib's "core wiring" folder and historically holds related concerns side-by-side (ActionManager / HotkeyManager / ModifierState all live there too). Splitting now creates churn without a clear naming gain; defer until the folder grows materially.

### ISSUE-30 ✅ Tighten IntersectionObserverEntry cast
*Source: TASTE-3*
- **File:** `SettingsPanel.tsx`
- **Fix:** Replaced the `as HTMLElement` cast with an `instanceof HTMLElement` guard.

---

## Dismissed (with reason — see notes per item)

- ⁉️ TECH-1 — `matchesFieldType` switch IS exhaustive over the discriminated union; TS would flag a real gap.
- ⁉️ TECH-7 — Already handled; reviewer admitted in their own write-up.
- ⁉️ ARCH-3 — JS is single-threaded; ISSUE-7 covers the real mutation-during-notify case.
- ⁉️ DEVOPS-1 — Reviewer confirmed no collisions.
- ⁉️ DEVOPS-5 — Vite config glob already covers `lib/**/*.{ts,tsx}`.
- ⁉️ DEVOPS-7 — Wildcard sub-exports are intentional for Vite library mode.
- ⁉️ SLOP-7 — Log already includes the key name.
- ⁉️ TASTE-5 — Marked by-design by the reviewer.
- ⁉️ FUTURE-4 — Cross-tab sync explicitly deferred per user TODO.
- ⁉️ FUTURE-8 — Pollution risk is low and the warning would be noisy.
- ⁉️ DEVOPS-3 — Existing `pnpm test:treeshake` job covers this; no specific signal raised.
- ⁉️ FUTURE-6 — Useful follow-up; `app.*` stale-key risk is bounded.
- ⁉️ FUTURE-7 — Inherent to client-side defaults; documented in the guide.

---

## Verification

- `pnpm exec vitest run` → **2374 passed / 0 failed** (90 in the settings scope alone, including the new edge-case tests).
- `pnpm typecheck` clean for every settings-related file (pre-existing errors elsewhere are unchanged).
