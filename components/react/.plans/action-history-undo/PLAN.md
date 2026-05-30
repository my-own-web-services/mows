# Action History + Undo/Redo System

Status legend: `✅` done · `❌` open · `🚧` in progress · `⁉️` dismissed (with reason)

## Goal

Every UI interaction that goes through `ActionManager.dispatchAction` produces:

1. An **audit-log entry** — append-only record of *what happened, when, where, with what payload, by whom* — survivable across page reloads.
2. **Optionally** an **undo-stack entry** — pure-data description of how to reverse the action, also survivable across reloads (within the same tab) so the user can hit Ctrl+Z after a refresh.

Apps opt actions in to being reversible by adding an `invertAction` handler and returning an `UndoableAction` from `executeAction`. Read-only actions (open palette, copy to clipboard, navigation) need no changes.

This builds on the existing `ActionManager` (`lib/lib/mowsContext/ActionManager.tsx`) — single funnel for every dispatched action already exists. The recent-actions usage tracker stays as-is; the audit log is a separate concern.

## Multi-review status

Plan was reviewed by 10 perspectives (`./issue.md`). 33 findings folded into this revision; 7 accepted as deferred; 5 dismissed with reason. No open findings.

## Locked design decisions

| Aspect | Decision | Rationale |
|---|---|---|
| Stack scope | One global undo stack per app | Matches user expectation (Ctrl+Z anywhere). |
| Audit log persistence | localStorage, shared across tabs of the same origin | A history is the user's record; cross-tab visibility is useful. |
| Undo stack persistence | sessionStorage, per-tab | Cross-tab undo is a footgun. |
| Granularity | Only `dispatchAction` calls — drag-drop dispatches one action with a payload | Avoids logging raw input events; keeps log meaningful. |
| Inverse contract | Pure-data: `forwardPayload` + `inversePayload` + `actionId`; handler exposes `executeAction` + sibling `invertAction(inversePayload)` | Closures don't survive reload; pure data does. |
| Failure mode | On invert failure: toast + log.error with stack + keep entry; drop after `maxInvertRetries` retries | Nothing silently lost; bounded retry. |
| Sensitivity opt-out | Per-handler `excludeFromAuditPayload` and `excludeFromUndoStack` flags | Byte cap is a storage limit, not redaction. Apps must opt out for credentials/tokens/PII. |
| Payload size budget | Per-handler `payloadByteBudget` (default 4096); measured via `new Blob([JSON.stringify(payload)]).size`; oversize → audit entry without payload + no undo entry | Bounded storage; explicit measurement. |
| Surfaces | `mows.history.undo` (mod+z), `mows.history.redo` (mod+shift+z), `mows.history.open` (no default hotkey), `<HistoryPanel>` | All three opt-in surfaces. Hotkeys overridable per user. |
| Action ID namespace | Extend existing `CoreActionIds` enum in `coreActions.ts` with `UNDO`, `REDO`, `OPEN_HISTORY` (values: `mows.history.{undo,redo,open}`) | Reuse existing enum; matches category-qualified convention. |
| describe shape | `{ labelKey: string; params?: Record<string, string \| number> }`; resolves via existing flat `t.actions[labelKey]`; `formatActionLabel(labelKey, params, t)` helper interpolates `{name}` placeholders | No translation resolver rewrite; existing pattern reused. |
| HistoryPanel home | `lib/components/appShell/historyPanel/` | App chrome alongside CommandPalette + ModalHandler. |
| ID generation | `${performance.now()}-${tabId}-${counter}`; no ULID dep | Monotonic per tab, unique cross-tab, zero deps. |
| Compound transactions | `beginTransaction(groupKey)` / `endTransaction(groupKey)` in v1; wraps `replaceBlob` so JSON paste collapses to one undo entry | Avoids "Ctrl+Z reverts one field at a time" UX bug. |
| Cross-tab handling | Audit shared (storage event listener in SettingsManager); per-tab `tabId` on every entry; HistoryPanel shows other-tab entries muted with no "undo to here" | Forensic visibility + no footgun. |

## Data model

```ts
// lib/lib/mowsContext/ActionManager.tsx (additions)

export interface UndoableAction {
    readonly id: string;
    readonly actionId: string;                  // matches an Action.id in the registry
    readonly forwardPayload?: unknown;
    readonly inversePayload: unknown;
    readonly timestamp: number;
    readonly describe: { labelKey: string; params?: Record<string, string | number> };
    readonly transactionGroupId?: string;       // populated inside an open transaction; undo pops whole group
}

export interface AuditEntry {
    readonly id: string;
    readonly actionId: string;
    readonly category: string;
    readonly timestamp: number;
    readonly tabId: string;
    readonly payload?: unknown;                 // undefined when dropped (size or opt-out)
    readonly payloadDropped?: "oversize" | "opt-out";
    readonly modifiers: ModifierMask;
    readonly undoable: boolean;                 // historical fact: was an undo entry created at dispatch?
    readonly transactionGroupId?: string;
    readonly redoable?: boolean;                // reserved for v2 persisted redo
}

export interface ActionHistoryConfig {
    /** Hard cap on audit-log entries. Drops oldest 50% when storage quota hit. Default 500. */
    readonly maxAuditEntries: number;
    /** Hard cap on undo stack depth. Default 100. */
    readonly maxUndoStackDepth: number;
    /** Per-payload byte budget (default 4096). Measured via Blob size for UTF-8 accuracy. */
    readonly maxPayloadBytes: number;
    /** How many times to let the user retry a failing invert before auto-dropping. Default 3. */
    readonly maxInvertRetries: number;
    /** Kill switch for audit-log persistence. Default true. */
    readonly enabled: boolean;
}
```

`ActionHandler` grows:

```ts
export interface ActionHandler {
    // ...existing
    executeAction?: (event?, scopeElement?, payload?: unknown) =>
        void | UndoableAction;
    invertAction?: (inversePayload: unknown) => void | Promise<void>;
    /** Per-handler byte budget; falls back to ActionHistoryConfig.maxPayloadBytes when missing.
     *  Set to 0 to opt out of payload persistence entirely (entry still logged, payload field undefined). */
    readonly payloadByteBudget?: number;
    /** When true, never persist the payload of audit entries from this handler.
     *  Use for actions whose payload may contain credentials, tokens, file contents, or PII. */
    readonly excludeFromAuditPayload?: boolean;
    /** When true, never push an undo entry even if executeAction returns one.
     *  Use for sensitive irreversible actions ("Delete account"). */
    readonly excludeFromUndoStack?: boolean;
}
```

## Storage layout

| Slot | Backend | Key | Owner |
|---|---|---|---|
| Audit log | localStorage (via SettingsManager) | `${storagePrefix}_settings → device.auditLog` | SettingsManager |
| History config | localStorage (via SettingsManager) | `${storagePrefix}_settings → device.actionHistory` | SettingsManager |
| Undo stack | sessionStorage (via UndoStackManager) | `${storagePrefix}_undoStack` | UndoStackManager |
| Redo stack | in-memory only | n/a | ActionManager |

`UndoStackManager` accepts an `UndoStackStorageAdapter` (mirrors `SettingsStorageAdapter`) so React Native / SSR consumers can swap backends. Default adapter wraps sessionStorage with in-memory fallback (logged once).

Audit log rotation: when length exceeds `maxAuditEntries`, drop oldest. Storage quota exceeded: drop oldest 50% in one eviction; if still failing, disable persistence for the session and toast once.

Undo stack rotation: same. Redo stack: cleared on any new undoable dispatch.

## Cross-tab + storage event handling

`SettingsManager` constructor subscribes to `window.addEventListener("storage", …)`, filters for its own key, re-reads the blob, and notifies subscribers. Writing-tab is naturally suppressed by the browser (storage event fires only in other tabs).

Every entry includes `tabId` (sessionStorage-backed UUID per tab). HistoryPanel checks `entry.tabId === currentTabId` before enabling "undo to here".

## Component surfaces

### `mows.history.undo` / `mows.history.redo` / `mows.history.open`

Defined in `coreActions.ts` via the existing `CoreActionIds` enum. Hotkeys via `coreDefaultHotkeys` map: `mod+z` → undo, `mod+shift+z` → redo. No default hotkey for open (apps wire as needed). All overridable through the existing HotkeyManager user-override path.

Action labels are dynamic — `formatActionLabel(entry.describe.labelKey, entry.describe.params, t)` resolves the translation and interpolates `{name}` placeholders.

### `<HistoryPanel>` (new component)

Path: `lib/components/appShell/historyPanel/HistoryPanel.tsx`.

UX:

- Scrollable virtualized list (reuses `react-window` already in repo), newest first.
- Each row: icon (from resolved action icon, fallback if unknown), label (from `describe`), relative timestamp, "undo to here" affordance on undoable entries from the current tab.
- Empty-state copy.
- Filter by category, search by label.
- "Clear history" button — clears audit log + undo/redo stacks.
- Other-tab entries rendered muted with no "undo to here" button.
- Unknown-action entries (handler not registered in this session) rendered dimmed with generic icon + literal actionId.
- Modal-manager-mounted, opens via `mows.history.open`, Escape closes.
- Keyboard navigation (arrow keys + Enter), focus trap on open, focus restoration on close.

Follows the doc-page contract in CLAUDE.md.

## Failure + edge cases

| Case | Behaviour |
|---|---|
| Invert handler throws / rejects | `log.error(err)` with stack, toast via existing toast system, increment `entry.invertRetries`. Drop entry after `maxInvertRetries`. |
| Invert handler missing for an undoable entry | Toast "Cannot undo: handler not available", drop entry from stack. |
| User spams Ctrl+Z while previous invert is in-flight | `ActionManager.pendingInverts: Map<actionId, Promise<void>>` — subsequent presses ignored (with `log.debug`) until current resolves. Public `isInvertInFlight(actionId?)` accessor. |
| Payload exceeds budget | Entry logged with `payloadDropped: "oversize"`; no undo entry pushed. Developer warning logged with actionId + handler name + measured size. |
| `excludeFromAuditPayload` set | Entry logged with `payloadDropped: "opt-out"`; payload undefined. Undo stack entry still created (the inverse payload is required for reversal; if THAT is also sensitive, set `excludeFromUndoStack`). |
| `excludeFromUndoStack` set | No undo entry created regardless of `executeAction` return. Audit entry still logged. |
| Same actionId re-registered with a different handler after reload | No handler signature snapshot. Undo calls `invertAction(inversePayload)`; if it throws, retry path kicks in. Apps must maintain backwards-compat on `inversePayload` (documented in CLAUDE.md). |
| User opens app in two tabs; tab A dispatches an undoable action | Tab A's undo stack only. Tab B's audit log shows the entry via storage event, but `tabId` mismatch disables "undo to here" and Ctrl+Z is a no-op for it. |
| sessionStorage unavailable | UndoStackManager falls back to in-memory; one-shot warning. Audit log still works if localStorage works. |
| Storage quota exceeded on audit log write | Drop oldest 50% in one eviction. If still failing: disable persistence for the session, set internal flag, toast once "Action history will not persist for this session due to storage quota". |
| Forged audit/undo entry injected via direct storage write | `undo()` looks up actionId in the live handler registry; absent handlers → toast + drop. No HMAC (a JS-side secret is useless against an in-page attacker). |
| Concurrent dispatch (two undoable actions in same tick) | LIFO. Dispatch is synchronous; entries appended in call order; undo pops most recent. Tested. |
| Audit-log entry dropped via rotation while its undo-stack entry remains | When rotating audit entries, also drop matching undo-stack entries. When rotating undo entries (depth cap), audit `undoable` flag stays true (historical fact); HistoryPanel sees missing stack entry and disables "undo to here". |

## File-level task checklist

### Phase 1 — Core mechanics

- ❌ T1: `ActionManager.tsx` — add `UndoableAction`, `AuditEntry`, `ActionHistoryConfig` types; extend `ActionHandler` with `invertAction`, `payloadByteBudget`, `excludeFromAuditPayload`, `excludeFromUndoStack`. Add `formatActionLabel` helper + `measurePayloadBytes` helper.
- ❌ T2: `ActionManager.tsx` — extend `dispatchAction` to capture `UndoableAction` return, build `AuditEntry`, enforce byte budget + opt-out flags, rotate caps. Public accessor `isInvertInFlight(actionId?)`. Public `exportAuditLog()` and `onAuditEntry` callback config.
- ❌ T3: `ActionManager.tsx` — `undo()`, `redo()`, `beginTransaction(groupKey)`, `endTransaction(groupKey)`, `pendingInverts` map, retry counter. Failure semantics: log.error with stack + toast + retry + auto-drop.
- ❌ T4: HotkeyManager.tsx:66 — pass `event` through to `dispatchAction`. Update HotkeyManager.test.ts to assert the event is forwarded. (Blocking for accurate ISSUE-1.)
- ❌ T5: `UndoStackManager.ts` (new) — sessionStorage-backed with in-memory fallback. `UndoStackStorageAdapter` interface for swappable backend. Persists only the undo stack; redo stack stays in memory.
- ❌ T6: `SettingsManager.ts` — extend `DeviceSettings` with `auditLog?: unknown; actionHistory?: unknown`. `validateBlob` accepts them; on load, drop array entries with non-string `actionId` or missing `timestamp`. Add `storage` event listener subscribing the manager to cross-tab updates. Add `destroy()` method to unsubscribe.
- ❌ T7: `ActionManager` constructor — accept `auditLogSlot`, `undoStackManager`, `historyConfig`, plus existing `recentActionsSlot`. Constructor wires `onAuditEntry` callback if provided.
- ❌ T8: `MowsContext.tsx` — construct `UndoStackManager` with `props.storagePrefix`, pass with `auditLogSlot` to `ActionManager`. Call `settingsManager.destroy()` in `componentWillUnmount`.
- ❌ T9: `ActionManager.test.ts` + `UndoStackManager.test.ts` + `SettingsManager.test.ts` extensions — exhaustive coverage:
  - dispatch → audit entry created with correct modifiers (proves T4)
  - dispatch undoable → undo restores → redo restores
  - dispatch undoable → redo stack cleared on next dispatch
  - oversize payload → no undo entry, audit `payloadDropped: "oversize"`
  - `excludeFromAuditPayload` → audit `payloadDropped: "opt-out"`, payload undefined
  - `excludeFromUndoStack` → audit yes, undo no
  - async invert resolves → entry popped
  - async invert rejects → log.error called, toast emitted, entry stays on stack, retry counter incremented, dropped after maxInvertRetries
  - spam Ctrl+Z while invert in flight → second call ignored
  - missing handler on undo → toast + entry dropped
  - forged sessionStorage entry with unknown actionId → drop on undo
  - LIFO ordering on concurrent dispatch
  - audit rotation drops sibling undo entries
  - sessionStorage throws → in-memory fallback + one-shot warning
  - quota exceeded → drop oldest 50%, then disable + toast
  - cross-tab: two ActionManager instances, shared mock audit storage, separate undo storage → tab A action visible in tab B audit, tab B undo no-op
  - storage event from another tab → SettingsManager re-reads, notifies subscribers
  - beginTransaction/endTransaction → one undo entry pops the group
  - exportAuditLog returns deep clone (mutation doesn't affect internal state)

### Phase 2 — Built-in undo/redo/history actions + hotkeys + translations

- ❌ T10: `coreActions.ts` — extend `CoreActionIds` enum with `UNDO = "mows.history.undo"`, `REDO = "mows.history.redo"`, `OPEN_HISTORY = "mows.history.open"`. Add `CoreModalTypes.history = "history"`. Register handlers in `defineCoreActions` — undo/redo visibility tied to stack depth + dynamic labels from `describe` of next entry.
- ❌ T11: `coreDefaultHotkeys` — bind `mod+z` → UNDO, `mod+shift+z` → REDO. OPEN_HISTORY unbound by default.
- ❌ T12: Translations (both `lib/lib/languages/en-US/default.ts` and `lib/lib/languages/de/default.ts`):
  - `actions["mows.history.undo"]` = "Undo" / "Rückgängig"
  - `actions["mows.history.redo"]` = "Redo" / "Wiederholen"
  - `actions["mows.history.open"]` = "Open history" / "Verlauf öffnen"
  - `toast.undoFailed` = "Could not undo: {error}" / "Rückgängig fehlgeschlagen: {error}"
  - `toast.undoNoHandler` = "Cannot undo: action not available" / "Aktion nicht verfügbar"
  - `toast.undoDropped` = "Could not undo after {n} attempts; entry removed" / "Nach {n} Versuchen entfernt"
  - `toast.auditPersistenceDisabled` = "Action history will not persist for this session due to storage quota" / "Speicherkontingent erreicht — Verlauf wird nicht gespeichert"
- ❌ T13: Update `lib/lib/languages.ts` `Translation` interface schema to declare new keys (compile-time enforcement).

### Phase 3 — HistoryPanel + DocPage

- ❌ T14: `lib/components/appShell/historyPanel/HistoryPanel.tsx` — virtualized list (react-window), filter, search, undo-to-here, clear, a11y (arrow keys, Enter, focus trap, ARIA labels), other-tab muted rendering, unknown-action fallback. Uses existing UI primitives only.
- ❌ T15: `HistoryPanel.test.tsx` — covers:
  - renders entries newest-first
  - empty state
  - filter narrows
  - search-no-results state
  - very-long-label overflow (no layout break)
  - click undo-to-here pops N entries
  - undo-to-here partial failure halts at first failing entry
  - clear empties stack + audit
  - opens via `mows.history.open` action
  - keyboard nav (arrow up/down, Enter)
  - focus trap on open, focus restoration on close
  - XSS-safe: `describe.params` with `<img onerror=alert(1)>` renders as text
  - other-tab entries muted, no "undo to here" button
  - unknown-action entry dimmed with literal actionId
- ❌ T16: `src/examples/historyPanel/{Default,Filtered,Empty}.tsx` + `HistoryPanelDocPage.tsx` + `index.ts`. Add entry to `src/demos.tsx`. DocPage follows CLAUDE.md contract.
- ❌ T17: Translations for HistoryPanel UI:
  - `historyPanel.title` = "Action history" / "Verlauf"
  - `historyPanel.emptyState` = "No actions yet" / "Noch keine Aktionen"
  - `historyPanel.searchPlaceholder` = "Search…" / "Suchen…"
  - `historyPanel.categoryFilter` = "Filter by category" / "Nach Kategorie filtern"
  - `historyPanel.undoToHere` = "Undo to here" / "Bis hierhin rückgängig"
  - `historyPanel.clearButton` = "Clear history" / "Verlauf löschen"
  - `historyPanel.clearConfirmation` = "Clear all history? This cannot be undone." / "Gesamten Verlauf löschen? Nicht widerrufbar."
  - `historyPanel.unknownAction` = "Unknown action" / "Unbekannte Aktion"
  - `historyPanel.otherTab` = "From another tab" / "Aus anderem Tab"

### Phase 4 — Worked example + e2e

- ❌ T18: Add `invertAction` to a sample action. **Choice: theme toggle** — `setTheme` already snapshots previous theme; invertAction reapplies it. Wire via `defineCoreActions` so theme-change goes through the action funnel (rather than direct `setTheme` calls). Vitest test: dispatch theme change → invert restores.
- ❌ T19: `e2e/actionHistory.spec.ts` (Playwright):
  - dispatch theme change → reload page → press Ctrl+Z → assert theme reverted
  - dispatch theme change → unregister handler → press Ctrl+Z → toast appears, entry dropped
  - open two pages → dispatch in page A → page B history shows entry as muted, Ctrl+Z is no-op
  - wrap a `SettingsPanel` JSON paste in `beginTransaction` → press Ctrl+Z once → all fields revert together
- ❌ T20: Wrap `SettingsManager.replaceBlob` callers in `beginTransaction("settings.replaceBlob")` / `endTransaction(...)` so JSON paste collapses to one undo entry.

### Phase 5 — Docs + final verification

- ❌ T21: `components/react/CLAUDE.md` — new "Action history + undo" section mirroring "Settings system" structure:
  - Overview
  - Quick start (define an action with `invertAction`, return `UndoableAction`)
  - Handler contract (executeAction signature, payload sensitivity flags, invert error path)
  - Transactions (beginTransaction/endTransaction)
  - Cross-tab + multi-tenant (storagePrefix isolation, undo stack scope)
  - Testing
  - Limitations (no persisted redo; reload + handler-signature drift)
- ❌ T22: `pnpm build && pnpm test && pnpm e2e` clean. Run multi-review on the implementation diff. Address findings in a follow-up issue.md under `.plans/action-history-undo/`.

## Out of scope (v1)

- Persisted **redo** stack — `redoable?: boolean` field reserved on AuditEntry for v2.
- Schema versioning for `inversePayload` across reloads — documented constraint that handlers maintain backwards-compat.
- Group adjacent same-actionId entries visually — removed; v2 polish if needed.
- AI-generated dynamic descriptions — `describe.labelKey` shape doesn't preclude later extension.
- Splitting ActionManager into `AuditLogManager` + `UndoRedoManager` — deferred; code organised with section headers for future mechanical split if the file grows beyond 800 LOC.
- Legacy `recentActionsStorageKey` / `configStorageKey` fallback cleanup — separate follow-up PR.
- Multi-review CI automation — manual pre-merge step.

## Implementation order

Phases are gated: 1 must build + test green before 2 starts, etc. Within a phase, tasks may parallelise.

T4 (HotkeyManager event passthrough) is in Phase 1 because audit-log modifier capture depends on it. All Phase 1 tests assume T4 is done.
