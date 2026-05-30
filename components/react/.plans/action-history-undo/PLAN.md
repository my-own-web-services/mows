# Action History + Undo/Redo System

Status legend: `✅` done · `❌` open · `⁉️` dismissed (with reason)

## Goal

Every UI interaction that goes through `ActionManager.dispatchAction` produces:

1. An **audit-log entry** — append-only record of *what happened, when, where, with what payload, by whom* — survivable across page reloads.
2. **Optionally** an **undo-stack entry** — pure-data description of how to reverse the action, also survivable across reloads (within the same tab) so the user can hit Ctrl+Z after a refresh.

Apps opt actions in to being reversible by adding an `invertAction` handler and returning an `UndoableAction` from `executeAction`. Read-only actions (open palette, copy to clipboard, navigation) need no changes.

This builds on the existing `ActionManager` (`lib/lib/mowsContext/ActionManager.tsx`) — single funnel for every dispatched action already exists. The recent-actions usage tracker stays as-is; the audit log is a separate concern.

## Locked design decisions

| Aspect | Decision | Rationale |
|---|---|---|
| Stack scope | One global undo stack per app | Matches user expectation (Ctrl+Z anywhere). |
| Audit log persistence | localStorage, shared across tabs of the same origin | A history is the user's record; cross-tab visibility is useful. |
| Undo stack persistence | sessionStorage, per-tab | Cross-tab undo is a footgun ("tab B undoes tab A's move"). |
| Granularity | Only `dispatchAction` calls — drag-drop dispatches one action with a payload | Avoids logging raw input events; keeps log meaningful. |
| Inverse contract | Pure-data: `forwardPayload` + `inversePayload` + `actionId`; handler exposes `executeAction` + sibling `invertAction(inversePayload)` | Closures don't survive reload; pure data does. |
| Failure mode | On invert failure: toast + **keep** entry on the undo stack | Nothing silently lost; user retries. |
| Payload policy | Always persist; per-handler `payloadByteBudget` (default 4 KB); global cap configurable via settings; oversized payloads dropped → entry becomes session-only-undoable | Bounded storage, app-controlled with user override. |
| Surfaces | `mows.undo` (Ctrl+Z), `mows.redo` (Ctrl+Shift+Z), command-palette entries with dynamic labels, dedicated history panel | All three opt-in surfaces from the design discussion. |

## Data model

```ts
// lib/lib/mowsContext/ActionManager.tsx (additions)

export interface UndoableAction {
    readonly actionId: string;
    readonly forwardPayload?: unknown;
    readonly inversePayload: unknown;
    readonly timestamp: number;
    readonly describe: { key: string; params?: Record<string, string | number> };
}

export interface AuditEntry {
    readonly id: string;                        // ulid-ish, monotonic per tab
    readonly actionId: string;
    readonly category: string;
    readonly timestamp: number;
    readonly tabId: string;                     // distinguishes cross-tab origin
    readonly payload?: unknown;                 // null if oversized/opted out
    readonly payloadDropped?: "oversize" | "opt-out";
    readonly modifiers: ModifierMask;
    readonly undoableRef?: string;              // pointer to UndoableAction.id when this entry has an undo entry
}

export interface ActionHistoryConfig {
    readonly maxAuditEntries: number;           // hard cap (default 500)
    readonly maxUndoStackDepth: number;         // hard cap (default 100)
    readonly maxPayloadBytes: number;           // global cap (default 4096)
    readonly enabled: boolean;                  // kill switch (default true)
}
```

`ActionHandler` grows:

```ts
export interface ActionHandler {
    // ...existing
    executeAction?: (event?, scopeElement?, payload?: unknown) =>
        void | UndoableAction;
    invertAction?: (inversePayload: unknown) => void | Promise<void>;
    /** Per-handler byte budget; if missing, falls back to the manager-wide
     *  `maxPayloadBytes`. Set to 0 to opt out of payload persistence
     *  entirely (entry still logged, payload field stays empty). */
    readonly payloadByteBudget?: number;
}
```

## Storage layout

Audit log → `device.auditLog` (existing SettingsManager device slot pattern, shared across tabs via localStorage).

Undo + redo stacks → sessionStorage under `${storagePrefix}_undo` (NEW dedicated key, not in SettingsManager). Rationale: SettingsManager wraps localStorage; mixing sessionStorage there would muddy its contract. Self-contained `UndoStackStore` class with the same get/set/subscribe shape so tests can fake it.

History config → `device.actionHistory` (lives alongside audit log, defaults applied on read).

Audit log entry rotation: when length exceeds `maxAuditEntries`, drop oldest. Undo stack rotation: same. Redo stack: cleared on any new undoable dispatch.

## Component surfaces

### `mows.undo` / `mows.redo` (built-in actions)

Defined in `lib/lib/mowsContext/coreActions.ts` (new — or extension of existing core actions module). Wired into `coreDefaultHotkeys` as `mod+z` / `mod+shift+z`. Visibility computed from undoStack/redoStack length; label rendered from the next entry's `describe`.

### `mows.history.open` (built-in action)

Opens the new `<HistoryPanel>` via the existing modal manager.

### `<HistoryPanel>` (new component)

Path: `lib/components/appShell/historyPanel/HistoryPanel.tsx` (lives in `appShell/` because it's app chrome alongside `CommandPalette` — flagged the option of a new `history/` group during design; defer until we have a second history-related component).

UX:

- Scrollable list, newest first.
- Each row: icon (from the action's resolved icon), human label (`describe`), relative timestamp, "undo to here" affordance on undoable entries.
- Group adjacent same-actionId entries visually ("3× Move file").
- "Clear history" button (clears audit log + undo/redo stacks).
- Filter by category, search by label.
- Behaves like other modals: opens via `mows.history.open`, closes on Escape.

Follows the docs-harness contract (CLAUDE.md "Doc pages" section): `<HistoryPanelDocPage>` with all required sections, example files in `src/examples/historyPanel/`, behaviour tests with line references.

## Failure + edge cases

| Case | Behaviour |
|---|---|
| Invert handler throws / rejects | `log.warn`, toast via existing toast system, entry stays at top of undoStack so user can retry. Redo stack untouched. |
| Invert handler missing for an undoable entry on the stack (handler unregistered between dispatch and undo) | Toast "Cannot undo: handler not available", drop the entry from the stack (this is a wiring bug, not a recoverable state). |
| User spams Ctrl+Z while previous invert is in-flight | Single-flight lock: subsequent presses ignored until the current invert resolves. Visible "Undoing…" state on the toolbar/history panel. |
| Payload exceeds budget | Entry logged with `payloadDropped: "oversize"`; for **undoable** actions, the `UndoableAction.inversePayload` is also dropped → entry is recorded in audit log only, **not** pushed to the undo stack (we can't reverse what we didn't capture). Log warning so the developer knows their action exceeded its budget. |
| Same actionId re-registered with a different handler signature after reload | We don't snapshot handler signatures. Undo just calls `invertAction(inversePayload)` — if the new handler can't parse the old payload, it should throw a typed error and the standard "invert failed" path kicks in. |
| User opens app in two tabs; tab A dispatches an undoable action | Tab A's undo stack only. Tab B's audit log shows the entry (via storage event), but Tab B's Ctrl+Z does nothing for it. |
| sessionStorage unavailable (Safari private, embedded contexts) | Undo stack falls back to in-memory; audit log still works if localStorage works. Log one-shot warning. |
| Storage quota exceeded on audit log write | Drop oldest 25% of entries and retry; if still failing, disable audit-log persistence for the session and toast. |

## File-level task checklist

### Phase 1 — Core mechanics

- ❌ T1: `ActionManager.tsx` — add `UndoableAction`, `AuditEntry`, `ActionHistoryConfig` types; extend `ActionHandler` with `invertAction` + `payloadByteBudget`.
- ❌ T2: `ActionManager.tsx` — capture `UndoableAction` return from `executeAction`; build audit entry; enforce byte budget; rotate caps.
- ❌ T3: `ActionManager.tsx` — implement `undo()`, `redo()`, single-flight lock, failure semantics (toast keeps entry on stack).
- ❌ T4: New `UndoStackStore.ts` next to ActionManager — sessionStorage-backed get/set/subscribe with in-memory fallback.
- ❌ T5: `SettingsManager.ts` — add `device.auditLog` + `device.actionHistory` slot types. Update `validateBlob` to allow them through.
- ❌ T6: Wire SettingsManager + UndoStackStore into ActionManager constructor (replace the existing single-slot pattern with a config bag).
- ❌ T7: `MowsContext.tsx` — instantiate UndoStackStore with `props.storagePrefix`, pass into ActionManager.
- ❌ T8: `ActionManager.test.ts` — exhaustive tests: dispatch → log entry, dispatch undoable → undo restores, invert failure keeps entry, oversize drops payload, rotation, single-flight lock.

### Phase 2 — Built-in actions + hotkeys

- ❌ T9: `coreActions.ts` (new module or addition to existing) — define `mows.undo`, `mows.redo`, `mows.history.open` with state visibility tied to stack depth + dynamic labels from `describe`.
- ❌ T10: `coreDefaultHotkeys` — bind `mod+z` / `mod+shift+z` (do NOT bind history-panel open by default; let app opt in).
- ❌ T11: Translations — `de` + `en-US` defaults: `actions.mows.undo`, `actions.mows.redo`, `actions.mows.history.open`, toast strings (`undoFailed`, `undoNoHandler`, `undoBusy`).
- ❌ T12: HotkeyManager — verify dispatch path picks up the modifier from the keydown event (it currently calls `dispatchAction` without the event; needs `event` passed through so the audit log records modifiers correctly). Add a test.

### Phase 3 — UI surface

- ❌ T13: `lib/components/appShell/historyPanel/HistoryPanel.tsx` — modal panel, list, filter, clear button, "undo to here". Use existing UI primitives (`Button`, `Input`, `ScrollArea`); no raw HTML controls.
- ❌ T14: `HistoryPanel.test.tsx` — covers: renders entries, click undo-to-here pops N entries, filter narrows, clear empties stack, opens via action.
- ❌ T15: `HistoryPanel.md` — design rationale + mounting rules (modal manager, must live inside `<MowsProvider>`).
- ❌ T16: `src/examples/historyPanel/HistoryPanelDocPage.tsx` + mode example files + register in `src/examples/historyPanel/index.ts` + add route in App.tsx + sidebar entry + harness registry-integrity test.
- ❌ T17: Translations for history panel (panel title, empty state, filter labels, "undo to here", clear confirmation).

### Phase 4 — Concrete worked example

- ❌ T18: Pick one existing action with a natural inverse (candidate: settings toggles in `SettingsPanel` — e.g. theme change, language change). Add `invertAction` to its handler; verify Ctrl+Z reverts.
- ❌ T19: E2E test (`e2e/actionHistory.spec.ts` if Playwright is wired, otherwise extend existing harness) — dispatch a real action, refresh page, hit Ctrl+Z, assert reverted state.

### Phase 5 — Docs + integrity

- ❌ T20: `CLAUDE.md` — new "Action history + undo" section explaining the contract for app authors writing actions.
- ❌ T21: `registryIntegrity.test.ts` — ensure new translations exist for both locales.
- ❌ T22: `pnpm build && pnpm test` clean. Run multi-review on the diff. Address findings.

## Out of scope (v1)

- Persisted **redo** stack — redo is session-only. Surviving redo across reload is rare-need and doubles the persistence surface.
- Compound transactions (multi-action grouping into one undo step). Could be added later via a `beginTransaction()` / `endTransaction()` API; not needed for v1.
- Server-sync of the audit log. The slot lives in `device` precisely because it shouldn't sync.
- Per-action override of the global persistence cap from user settings (only the global cap is user-configurable in v1).
- Audit-log export UI (raw JSON copy is enough for v1; a CSV/file export can come later).

## Open questions to surface in multi-review

1. Is `appShell/historyPanel/` the right home, or should we create a `history/` taxonomy group? (Plan defaults to `appShell/`; flagged.)
2. Should `describe.key` resolve through the existing `Translation` interface (which would need a new `actions.<id>.describe` nested namespace) or via a separate `actionDescriptions` slot? (Plan defaults to nested in `Translation` for consistency.)
3. Does the single-flight lock need a user-visible "Undoing…" affordance, or is the existing toast queue enough? (Plan defaults to no extra affordance; toast on failure only.)
4. For the worked example (T18), is reverting a theme/language toggle a useful demo, or should we wait until a more obviously stateful action (file rename, item move) lands?

## Implementation order

Phases are gated: 1 must build + test green before 2 starts, etc. Within a phase, tasks may parallelise.

Total estimated diff: ~1500–2000 LOC across ~12 files (mostly in ActionManager, MowsContext wiring, new HistoryPanel component + tests + docs).
