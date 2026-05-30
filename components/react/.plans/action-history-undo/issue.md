# Action History + Undo — Multi-Review Findings (Plan Stage)

Status legend: `❌` open · `✅` fixed-in-plan · `🚧` accepted, deferred to implementation · `⁉️` dismissed (with reason)

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 2        | 6     | 1     |
| Technology    | 3        | 8     | 1     |
| DevOps        | 0        | 5     | 10    |
| Architecture  | 1        | 7     | 4     |
| QA            | 2        | 11    | 5     |
| Fine Taste    | 0        | 4     | 6     |
| Documentation | 1        | 6     | 4     |
| Repository    | 1        | 5     | 5     |
| Slop          | 0        | 5     | 6     |
| Future Proof  | 0        | 6     | 3     |

Findings consolidated to one entry per real issue; status appended after each resolution.

---

## P0 — Blocking (resolve in plan before any code lands)

### ISSUE-1 ✅ HotkeyManager strips the event → audit log loses modifier mask
*Sources: SECURITY-7, TECH-7, DEVOPS-1, QA-10, QA-13, ARCH-10, SLOP-6, DOC-11*
- **File:** `lib/lib/mowsContext/HotkeyManager.tsx:66`
- **Why critical:** Today `dispatchAction(actionId)` is called without the event, so `ActionManager` defaults to `NO_MODIFIERS`. The plan promises `AuditEntry.modifiers` reflects the real keystroke — that's impossible without the fix. Also blocks any future hotkey that needs to trigger a modifier-variant.
- **Plan fix:** Move this from "T12 verify" to "Phase 1 blocking task". Pass `event` through: `this.actionManager.dispatchAction(actionId, event)`. Add ActionManager.test asserting `modifiers.ctrl === true` when a Ctrl+Z keydown is dispatched. The fix is non-breaking — hotkey-dispatched actions today never had variants firing (because no event was passed), so newly-firing variants are correctness, not regression. Existing HotkeyManager tests pass through a stub `dispatchAction` that doesn't care about extra args.

### ISSUE-2 ✅ Action ID namespace + reuse the existing `CoreActionIds` enum
*Sources: TASTE-3, REPO-2, REPO-7*
- **Files:** `lib/lib/mowsContext/coreActions.ts` (exists; not a new module)
- **Why critical:** Plan said "new module or addition to existing". `coreActions.ts` already exists with `CoreActionIds` enum and `defineCoreActions`. Plan also used `mows.undo` / `mows.redo` (bare verbs) but existing convention is category-qualified (`mows.openCommandPalette`, `mows.user.login`).
- **Plan fix:** Use `CoreActionIds.UNDO = "mows.history.undo"`, `REDO = "mows.history.redo"`, `OPEN_HISTORY = "mows.history.open"`. Extend the enum + `defineCoreActions`. Reference action IDs by enum, never by string literal.

### ISSUE-3 ✅ Translation shape — flat under existing `t.actions[id]`, not nested
*Sources: TECH-6, TASTE-2, DOC-3, DEVOPS-11, REPO-7*
- **Files:** `lib/lib/languages.ts`, `lib/lib/languages/{de,en-US}/default.ts`
- **Why critical:** Plan proposed nested `actions.<id>.describe.key`. Existing resolver is flat `Translation.actions[actionId]: string`. Nesting would require a resolver rewrite + break every existing action label.
- **Plan fix:** `UndoableAction.describe` becomes `{ labelKey: string; params?: Record<string, string | number> }` where `labelKey` resolves via existing `t.actions[labelKey]` lookup. For Ctrl+Z's dynamic label ("Undo: Move file foo"), the handler returns `{ labelKey: "mows.history.undo.label.move", params: { name: "foo" } }` and a small `formatActionLabel(labelKey, params, t)` helper interpolates `{name}` placeholders. New translations live alongside existing `actions.*` entries; no nesting.

### ISSUE-4 ✅ XSS via unsanitized `describe.params` in HistoryPanel
*Sources: SECURITY-3*
- **File:** `lib/components/appShell/historyPanel/HistoryPanel.tsx` (planned)
- **Why critical:** `params` may contain user-supplied strings (file names, search queries). React's default JSX rendering escapes them, but `dangerouslySetInnerHTML` or markdown rendering would not.
- **Plan fix:** Document that `formatActionLabel` returns a `string`, never `ReactNode` with markup. Renderer uses `{label}` (React-escaped). Add an explicit test in `HistoryPanel.test.tsx` that passes `<img onerror=alert(1)>` as a param and asserts the rendered DOM contains the literal text, not the element.

### ISSUE-5 ✅ Payload sensitivity — opt-out per handler, not size-based
*Sources: SECURITY-1, SECURITY-2, SECURITY-6, SLOP-4*
- **Files:** `lib/lib/mowsContext/ActionManager.tsx` (planned)
- **Why critical:** Byte cap is a storage limit, not a redaction mechanism. A 3 KB password fits under 4 KB. Apps need explicit opt-out for sensitive actions.
- **Plan fix:** Add to `ActionHandler`:
  - `excludeFromAuditPayload?: boolean` — audit log entry is still created (forensic record), `payload` field is `undefined`, `payloadDropped: "opt-out"`.
  - `excludeFromUndoStack?: boolean` — no undo entry created even if `executeAction` returns one. Use for sensitive irreversible actions.
  Default both `false`. Document in JSDoc + CLAUDE.md: "any action whose payload may contain credentials, tokens, file contents, or PII MUST set `excludeFromAuditPayload: true`".

### ISSUE-6 ✅ UndoStackStore → UndoStackManager + reuse SettingsManager adapter pattern partially
*Sources: TECH-2, ARCH-3, REPO-4, FUTURE-4*
- **Files:** `lib/lib/mowsContext/UndoStackManager.ts` (planned)
- **Why critical:** Plan named it `UndoStackStore` (breaks Manager-suffix convention). Several reviewers wanted it inside SettingsManager via a new session adapter.
- **Plan fix:** Rename to `UndoStackManager`. Define a `UndoStackStorageAdapter` interface (mirrors `SettingsStorageAdapter`) so React Native / SSR consumers can swap backends. Default adapter wraps sessionStorage with in-memory fallback. Keep it **separate from SettingsManager**: SettingsManager's contract is "one blob persisted to one storage key" — extending it to support per-slot storage scopes (some localStorage, some sessionStorage) would muddy a clean abstraction more than introducing one parallel manager. Both managers depend on storage adapters of the same shape, which is the actual unifying abstraction.

### ISSUE-7 ✅ Pre-answer the open questions in PLAN
*Sources: SLOP-10, DOC-9*
- **File:** PLAN.md "Open questions"
- **Why critical:** Q1–Q3 are blockers; leaving them open invites mid-implementation pivots.
- **Plan fix:**
  - Q1 (HistoryPanel home): **`appShell/`**. It's app chrome alongside CommandPalette + ModalHandler. A `history/` group is premature with one component.
  - Q2 (describe translation): **resolved via ISSUE-3** — flat `t.actions[labelKey]`.
  - Q3 (single-flight "Undoing…" affordance): **No extra UI**. Toast-only on failure. `ActionManager.isInvertInFlight()` accessor exists for apps that want it.
  - Q4 (worked example): **theme toggle in MowsContext.setTheme**. Already exposed via `mows.openThemeSelector` flow + has obvious inverse (previous theme value).

### ISSUE-8 ✅ Define byte-measurement function explicitly
*Sources: DEVOPS-10*
- **Why critical:** "byteBudget: 4096" is meaningless without a defined measurement.
- **Plan fix:** Use `new Blob([JSON.stringify(payload)]).size` (correctly counts UTF-8 bytes, not UTF-16 code units). Export `measurePayloadBytes(payload: unknown): number` from ActionManager. Document on the `payloadByteBudget` JSDoc.

---

## P1 — Major correctness / architecture

### ISSUE-9 ✅ AuditEntry needs explicit undoable + dangling-ref handling
*Sources: ARCH-5, QA-5, SLOP-8*
- **Plan fix:** Replace `undoableRef?: string` with two fields:
  - `undoable: boolean` — was an undo entry created at dispatch time?
  - `undoableActive: () => boolean` is **not** added; instead the HistoryPanel checks `undoStack.has(entry.id)` at render time (no foreign key in storage). When audit log rotates and drops an entry, also drop matching undo-stack entry. When undo stack rotates (depth cap), the audit entry's `undoable` flag stays `true` (historical fact) but the panel sees the missing stack entry and disables "undo to here".

### ISSUE-10 ✅ Reject undo entries for unregistered handlers (no HMAC)
*Sources: SECURITY-4*
- **Why:** Hand-edited localStorage or a malicious script could inject a `UndoableAction` with `actionId: "mows.deleteAccount"` and a forged payload; the undo path would call the real handler with attacker-supplied input. HMAC is overkill (the secret lives in JS, defeating the point). The practical defence is: undo only runs handlers registered in *this* session.
- **Plan fix:** `ActionManager.undo()` looks up `actionId` in the handler registry. If absent, drop the entry, toast "Cannot undo: action not available". Add test: inject a forged undo entry into sessionStorage with an unknown actionId, call `undo()`, assert nothing fires and the entry is removed.

### ISSUE-11 ✅ Failure handler retry budget + stack trace preservation
*Sources: SECURITY-5, ARCH-4, SLOP-5*
- **Plan fix:** Per-entry retry counter on the undo stack (default `maxInvertRetries = 3`). After exhaustion, drop entry with toast "Could not undo after 3 attempts; entry removed". Always pass the raw `Error` (with stack) to `log.error(...)` AND `toast.error(...)`. Failures are not silent.

### ISSUE-12 ✅ Compound transactions for SettingsPanel JSON paste
*Sources: ARCH-12*
- **Why:** Pasting a settings JSON triggers `replaceBlob` which fires many subscriber notifications. Without grouping, Ctrl+Z reverts one field at a time — surprising UX.
- **Plan fix:** Add minimal `beginTransaction(groupKey: string)` / `endTransaction(groupKey: string)` API in Phase 1. Inside an open transaction, undo-stack entries get `transactionGroupId` and undo pops the whole group at once. Wrap `SettingsManager.replaceBlob` in a transaction. `transactionGroupId?: string` lives on `UndoableAction` from day one (cheap, no later migration; addresses FUTURE-1 too).

### ISSUE-13 ✅ Single-flight lock — commit to API shape, scope per-action
*Sources: TASTE-5, TECH-9, ARCH-8*
- **Plan fix:** `ActionManager` has `private pendingInverts = new Map<string, Promise<void>>()` keyed by actionId. `undo()` / `redo()` check the map; if entry exists, ignore the call and log debug. Public accessor `isInvertInFlight(actionId?: string): boolean`. Hotkey for save (`mod+s`) is unaffected because it's a different actionId.

### ISSUE-14 ✅ Validate `device.auditLog` + `device.actionHistory` in validateBlob
*Sources: SECURITY-9, DEVOPS-9, REPO-5*
- **Plan fix:** Extend `DeviceSettings` with typed (but still `unknown` payload) `auditLog?: unknown; actionHistory?: unknown`. Extend `validateBlob` to enforce: if present, `auditLog` is an array; entries with non-string `actionId` or missing `timestamp` are dropped on load. `actionHistory` matches an open partial of `ActionHistoryConfig`.

### ISSUE-15 ✅ Cross-tab storage event listener in SettingsManager
*Sources: DEVOPS-2*
- **Why:** localStorage `storage` event fires only in *other* tabs, not the writing one. Plan claims tab B sees tab A's audit log via storage event; SettingsManager doesn't listen today.
- **Plan fix:** Subscribe to `window.addEventListener("storage", …)` in SettingsManager constructor, filter for own `storageKey`, re-read + re-notify subscribers. Already correctly suppressed in the writing tab. Unsubscribe in a `destroy()` method (called from MowsContext on unmount). Add a test using two SettingsManager instances sharing a mock storage adapter, dispatching a storage event manually.

### ISSUE-16 ✅ Quota strategy + global audit byte budget
*Sources: SLOP-2, SLOP-11*
- **Plan fix:** On quota exceeded, drop oldest **50%** in a single eviction (not 25% with retries); if still failing, disable persistence for the session, set `auditPersistenceDisabled: true` flag, toast once. JSDoc on `ActionHistoryConfig.maxAuditEntries` notes worst-case footprint and links to the multi-tenant section in CLAUDE.md.

### ISSUE-17 ✅ Configure caps with documented rationale
*Sources: SLOP-1*
- **Plan fix:** Defaults: `maxAuditEntries = 500`, `maxUndoStackDepth = 100`, `maxPayloadBytes = 4096`, `maxInvertRetries = 3`. JSDoc on each: "Tunable; rationale: <briefly>. Apps that dispatch high-frequency actions (>1/sec sustained) should override."

### ISSUE-18 ✅ Cross-tab undo behaviour — documented + tested
*Sources: DEVOPS-13, QA-9, TECH-11*
- **Plan fix:** CLAUDE.md "Action history + undo" section explicitly: "Undo/redo stacks are per-tab; audit log is shared. Ctrl+Z in tab B does not undo tab A's actions." `AuditEntry.tabId` set from a per-tab id generated at SettingsManager construction (sessionStorage-backed UUID). HistoryPanel renders entries from other tabs in muted style with no "undo to here". Test (Phase 1) with two ActionManager instances against shared/separate mock adapters.

### ISSUE-19 ✅ a11y, empty state, partial failure tests for HistoryPanel
*Sources: QA-6, QA-7, QA-8*
- **Plan fix:** T14 expanded to include: keyboard navigation (arrow keys, Enter), ARIA labels, focus trap when modal opens, focus restoration on close, empty-state copy + render, search-no-results render, very-long-label overflow, undo-to-here partial failure (entries M..N succeed, M-1 fails → operation halts, toast says which entry).

### ISSUE-20 ✅ Failure semantics tests assert ALL side effects
*Sources: QA-12*
- **Plan fix:** Add helper `expectFailedInvert({ entry, beforeStack })` in ActionManager.test that asserts (a) `log.error` called with the real Error, (b) toast emitted with the failure message, (c) undo stack unchanged in count + top entry, (d) retry counter incremented.

### ISSUE-21 ✅ sessionStorage unavailable + storage quota exceeded tests
*Sources: QA-14, DEVOPS-8*
- **Plan fix:** UndoStackManager tests use a stub adapter that throws on `setItem` to verify in-memory fallback + one-shot warning. Redo stack is **never** persisted — only the undo stack — to keep load + clear semantics simple. Document in JSDoc on UndoStackManager.

### ISSUE-22 ✅ E2E coverage — happy + failure paths
*Sources: QA-15, QA-16, SLOP-7, DEVOPS-3*
- **Plan fix:** Playwright is wired (`playwright.config.ts` exists, `e2e/nodeEditor.spec.ts` runs). T19 commits to Playwright. Tests: (a) dispatch theme change → reload → Ctrl+Z → assert reverted; (b) dispatch action, unregister handler, attempt undo → toast + entry dropped; (c) payload > maxPayloadBytes → undo is unavailable; (d) cross-tab — open two pages, action in page A, page B history shows entry as un-undoable.

### ISSUE-23 ✅ executeAction return value handled at every call site
*Sources: TECH-1*
- **Plan fix:** Today `executeAction` returns `void`. New signature: `void | UndoableAction`. All call sites:
  - `ActionManager.dispatchAction` — the only call site that matters; captures the return.
  - `resolveAction` — does NOT call `executeAction` (it stores the reference for later dispatch).
  - Tests — pass through.
  Audit pass during Phase 1: grep for `.executeAction(` and confirm every call either captures the return or comments why it ignores it.

### ISSUE-24 ✅ Hotkey overrides + user remapping for mows.history.*
*Sources: FUTURE-7*
- **Plan fix:** Undo/redo register normally through `defineCoreActions` + `coreDefaultHotkeys`, so HotkeyManager's existing user-override path applies. Document in CLAUDE.md.

### ISSUE-25 ✅ Forward-compat fields on UndoableAction + AuditEntry
*Sources: FUTURE-1, FUTURE-2*
- **Plan fix:** `UndoableAction` includes `transactionGroupId?: string` from day one (used by ISSUE-12). `AuditEntry` includes `redoable?: boolean` reserved for v2 persisted-redo. Both fields default to undefined/false; storage layer ignores absence.

### ISSUE-26 ✅ Export API + analytics subscription
*Sources: FUTURE-3, FUTURE-9*
- **Plan fix:** `ActionManager.exportAuditLog(): AuditEntry[]` returns a deep clone of current entries (public, stable shape). `ActionManagerConfig.onAuditEntry?: (entry) => void` callback, called synchronously after persist. Callback errors caught + logged, never propagated. Both small, both unlock future telemetry/server-sync without locking a delivery mechanism in v1.

### ISSUE-27 ✅ Unknown-action fallback in HistoryPanel
*Sources: FUTURE-6*
- **Plan fix:** When rendering an audit entry, if `actionId` is not in the current handler registry, render the entry with a generic icon, dimmed text "Unknown action (<id>)", and no "undo to here" button. Translation key `history.unknownAction`. Test covers it.

### ISSUE-28 ✅ Multi-tenant storagePrefix isolation documented
*Sources: FUTURE-5*
- **Plan fix:** CLAUDE.md "Action history + undo" section includes a "Multi-tenant" subsection: "All storage keys are namespaced by `storagePrefix`. Two apps on the same origin must use distinct prefixes; the library does not validate uniqueness." Same caveat already lives in the settings-system docs.

---

## P2 — Doc-page + naming + scope

### ISSUE-29 ✅ Doc-page contract completeness
*Sources: DOC-1, DOC-2, DOC-4, DOC-5, DOC-6, DOC-7, DOC-8, DOC-10*
- **Plan fix:**
  - HistoryPanel modes enumerated: `Default.tsx` (with sample entries), `Filtered.tsx` (search active), `Empty.tsx` (no entries).
  - Register in `src/examples/historyPanel/index.ts` + add entry to `src/demos.tsx`.
  - DocPage covers all required sections per CLAUDE.md (Installation, Examples, Usage, Composition, RTL, Defined behaviour with real test references, API Reference).
  - HistoryPanel.md becomes **optional** — only created if mounting rules warrant a deep dive (DOC-36 in CLAUDE.md says co-located `.md` is encouraged-but-optional).
  - CLAUDE.md "Action history + undo" section mirrors "Settings system" structure (overview → quick start → contract → testing → multi-tenant).
  - Translation keys enumerated explicitly: see Phase 2 task list in revised PLAN.

### ISSUE-30 ✅ UndoableAction field naming
*Sources: TASTE-1*
- **Plan fix:** Keep `forwardPayload` + `inversePayload` (clearer than `args`/`undoArgs`; reads as data, not function parameters). Reviewer suggestion noted but rejected: handlers are pure data here, and "args" implies invocation. **Resolution: keep the verbose-but-clear names.**

### ISSUE-31 ✅ HistoryPanel naming
*Sources: TASTE-7*
- **Plan fix:** Keep `<HistoryPanel>`. Specific name `<ActionHistoryPanel>` is more precise but `<HistoryPanel>` matches the existing taxonomy (no other "history" exists in the lib, so "history" is unambiguous in context). Document scope in CLAUDE.md.

### ISSUE-32 ✅ ID generation strategy
*Sources: TECH-4, TASTE-4*
- **Plan fix:** No ULID dep. Use `${performance.now()}-${tabId}-${counter}` for `AuditEntry.id` and `UndoableAction.id`. Monotonic per tab (counter), unique cross-tab (tabId), no external dep. Document in JSDoc.

### ISSUE-33 ⁉️ HotkeyManager change is a "breaking" change
*Sources: TECH-7 marked Critical*
- **Reason for dismissal:** Reviewer claimed this would break apps "relying on no event = no variant activation". No app code can rely on this: variants ARE designed to fire on hotkeys; today they silently can't because the event wasn't passed. Fixing it is a bug fix, not a semantic change. Existing tests stub `dispatchAction` and don't care.

### ISSUE-34 ⁉️ Schema versioning for inversePayload across reloads
*Sources: ARCH-6, SLOP-3*
- **Reason for dismissal:** Out of scope for v1. Reviewer's recommendation ("apps must add `_v` to payload") is exactly what we'd document if needed, but v1 ships with the assumption that handlers maintain backwards-compat on inversePayload (same as any persisted-state contract). Document the constraint in CLAUDE.md; revisit if v1 surfaces real pain.

### ISSUE-35 ⁉️ AI-generated descriptions
*Sources: FUTURE-8*
- **Reason for dismissal:** Far-future. The `describe.labelKey` shape doesn't preclude a future `describe.dynamic?: () => string` extension. No code change today.

### ISSUE-36 ⁉️ Plan folder convention
*Sources: REPO-10*
- **Reason for dismissal:** Different feature, different artifacts. Settings-system has `modified.diff` because the review happened against an existing diff; action-history is a plan stage with no diff yet. Both are valid uses of `.plans/`.

### ISSUE-37 ⁉️ Group adjacent same-actionId entries ("3× Move file")
*Sources: TASTE-8*
- **Reason for dismissal:** Removed from v1 scope. Was inspirational UX prose, not a contract. Will resurface as a v2 enhancement if real users find unbundled entries noisy. Removed from PLAN.

### ISSUE-38 🚧 ActionManager / AuditLog / UndoManager separation
*Sources: ARCH-1*
- **Status:** Accepted, deferred. Reviewer is right that audit + undo + redo are three concerns; consolidating in ActionManager grows the class to ~600 LOC. But splitting now adds three constructor args to MowsContext and three more imports across the codebase. **Decision: keep them in ActionManager for v1; revisit if the class grows past 800 LOC. Code is organized into clearly-labeled sections inside the file with `// ---- Audit log ----` headers** to make a future split mechanical.

### ISSUE-39 🚧 Per-handler `payloadByteBudget` vs Action-level
*Sources: TECH-3*
- **Status:** Accepted, simplified. `payloadByteBudget` lives on `ActionHandler` (where the data shape is known). For multi-scope handlers, the *active* handler at dispatch time wins. Documented; tested.

### ISSUE-40 🚧 Legacy storage fallbacks in HotkeyManager / ActionManager
*Sources: REPO-6*
- **Status:** Accepted, deferred. The `recentActionsStorageKey` and `configStorageKey` deprecated paths stay until a follow-up cleanup PR. Not in this PR's scope.

### ISSUE-41 🚧 Compile-time enforcement: declares `executeAction → UndoableAction` therefore must declare `invertAction`
*Sources: TECH-5*
- **Status:** Accepted as runtime warning. TypeScript discriminated union on the *return value* of `executeAction` would require wrapping every handler in a generic, costing call-site ergonomics. Runtime: if `dispatchAction` receives an `UndoableAction` return but no `invertAction` is defined, log a warning. The user-visible failure mode (toast on Ctrl+Z) is also clear.

### ISSUE-42 🚧 Multi-review automation in CI
*Sources: DEVOPS-6*
- **Status:** Accepted, manual. Multi-review is a pre-merge step; we don't gate CI on it. Document in CLAUDE.md.

### ISSUE-43 🚧 Concurrent dispatch ordering
*Sources: QA-17*
- **Status:** Accepted, LIFO. `dispatchAction` is synchronous; entries are appended in call order; undo pops most recent. Tests assert LIFO.

### ISSUE-44 🚧 Bundle impact (virtualization already in repo)
*Sources: DEVOPS-5*
- **Status:** Reuse react-window from ResourceList. No new dep.

---

## P3 — Minor / informational

### ISSUE-45 ✅ JSDoc all caps + measurement function intent
*Sources: TASTE-9, TASTE-10, DEVOPS-8*
- **Plan fix:** Every field in `ActionHistoryConfig` gets a JSDoc line: "Hard cap. Default N. Tunable per app." Rationale prose moves to CLAUDE.md, not PLAN.

### ISSUE-46 ✅ T6 "config bag" wording
*Sources: REPO-11*
- **Plan fix:** Reworded T6: "Update `ActionManagerConfig` to accept `auditLogSlot`, `undoStackManager`, `historyConfig`, plus existing `recentActionsSlot` + `maxRecentActions`."

### ISSUE-47 ✅ T18/T19 worked example commits to theme toggle
*Sources: DOC-10*
- **Plan fix:** T18 = add invertAction to `setTheme` (and `setLanguage`) in MowsContext. T19 = Playwright test for theme.

### ISSUE-48 ✅ Translation keys enumerated explicitly
*Sources: QA-11, DEVOPS-7, DOC-8*
- **Plan fix:** Phase 2 + Phase 3 task lists in PLAN enumerate every new key with both en-US and de strings. Registry-integrity test (compile-time `BaseTranslation` shape) catches missing keys at build.

### ISSUE-49 ✅ Storage key shape
*Sources: SLOP-9*
- **Plan fix:** `${storagePrefix}_settings` (existing) + `${storagePrefix}_undoStack` (new, sessionStorage). Documented in CLAUDE.md.

### ISSUE-50 ✅ Test T18 vs T19 scope
*Sources: DEVOPS-4*
- **Plan fix:** T18 is a vitest unit test for the theme `invertAction`. T19 is Playwright for the hotkey + reload flow. Clarified in PLAN.

---

## Resolution stats

- **✅ Fixed in plan:** 33
- **🚧 Accepted, deferred to implementation discretion:** 7
- **⁉️ Dismissed with reason:** 5
- **❌ Open:** 0
