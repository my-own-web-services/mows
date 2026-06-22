import { JSX } from "react";
import { toast as sonnerToast } from "sonner";
import { log } from "../logging";
import type { Translation } from "../languages";
import type { UndoStackManager } from "./UndoStackManager";

export interface ActionState {
    visibility: ActionVisibility;
    disabledReasonText?: string;
    /**
     * Optional leading icon. Rendered to the left of the action label by
     * `ActionDisplay`; ignored when `component` is set (which replaces the
     * whole label cell).
     */
    icon?: () => JSX.Element;
    /**
     * Optional label override. When unset, `ActionDisplay` falls back to the
     * action's translation entry (`t.actions[action.id]`). Variants typically
     * use this to morph the visible text without touching i18n keys.
     */
    label?: string;
    component?: () => JSX.Element;
}

export enum ActionVisibility {
    Shown = `Shown`,
    Disabled = `Disabled`,
    Hidden = `Hidden`
}

/**
 * Snapshot of currently-held keyboard modifiers. Sourced from
 * `useModifierState()` for live UI updates, or read directly off a
 * `MouseEvent` / `KeyboardEvent` at click/dispatch time.
 *
 * Variants are evaluated against this mask in `resolveAction` — first match
 * wins, so order variants from most-specific to least-specific.
 */
export interface ModifierMask {
    readonly shift: boolean;
    readonly alt: boolean;
    readonly ctrl: boolean;
    readonly meta: boolean;
}

export const NO_MODIFIERS: ModifierMask = Object.freeze({
    shift: false,
    alt: false,
    ctrl: false,
    meta: false
});

/**
 * Pull a `ModifierMask` from a synthetic or native event. Use this in
 * `executeAction` to derive intent from the *actual* click, not whatever the
 * user happened to be holding earlier. Defensive: missing modifier bits are
 * treated as `false`.
 */
export const modifierMaskFromEvent = (
    event: KeyboardEvent | MouseEvent | React.KeyboardEvent | React.MouseEvent | undefined | null
): ModifierMask => ({
    shift: event?.shiftKey ?? false,
    alt: event?.altKey ?? false,
    ctrl: event?.ctrlKey ?? false,
    meta: event?.metaKey ?? false
});

// =====================================================================
// Action history + undo/redo types
// =====================================================================

/**
 * Returned from `ActionHandler.executeAction` to declare the action is
 * reversible. The whole shape is pure data so it can round-trip through
 * sessionStorage across reloads — closures would not survive a refresh.
 *
 * `forwardPayload` records what was done (mostly for audit + replay); the
 * undo path only consumes `inversePayload` via the handler's `invertAction`.
 */
export interface UndoableAction {
    readonly id: string;
    /** Action.id registered in the manager — must be re-registered after
     * reload for undo to work. */
    readonly actionId: string;
    readonly forwardPayload?: unknown;
    readonly inversePayload: unknown;
    readonly timestamp: number;
    /** Human-readable description shown in the history panel and as the
     * dynamic label of `mows.history.undo` / `mows.history.redo`. Resolved
     * via `formatActionLabel`. */
    readonly describe: ActionLabelDescriptor;
    /** Populated when the action was dispatched inside an open transaction
     * (see `beginTransaction` / `endTransaction`). The undo path pops the
     * whole group as one operation. */
    readonly transactionGroupId?: string;
    /** Mutable retry counter for failed inverts — bounded by
     * `ActionHistoryConfig.maxInvertRetries`. */
    invertRetries?: number;
}

export interface ActionLabelDescriptor {
    /** Translation key — resolved via `t.actions[labelKey]`. */
    readonly labelKey: string;
    /** `{name}`-style placeholders interpolated into the resolved string.
     * Values are passed through React's default text rendering, so XSS is
     * not possible from this path (the rendered string is escaped). */
    readonly params?: Record<string, string | number>;
}

/**
 * Append-only record of one dispatched action. Persisted to localStorage
 * via `SettingsManager.device.auditLog` so the user's history survives
 * reloads and is visible across tabs of the same origin.
 */
export interface AuditEntry {
    readonly id: string;
    readonly actionId: string;
    readonly category: string;
    readonly timestamp: number;
    /** Identifies the originating tab — set from `ActionManager.tabId` so
     * the history panel can disable "undo to here" on cross-tab entries. */
    readonly tabId: string;
    readonly payload?: unknown;
    /** Why `payload` is missing, if it is. */
    readonly payloadDropped?: "oversize" | "opt-out";
    readonly modifiers: ModifierMask;
    /** Historical fact: did the dispatch return an `UndoableAction`?
     * The matching undo-stack entry may have rotated out already; the
     * history panel checks the stack at render time. */
    readonly undoable: boolean;
    readonly transactionGroupId?: string;
    /** Reserved for a future persisted-redo feature. Always `false` in v1. */
    readonly redoable?: boolean;
}

export interface ActionHistoryConfig {
    /** Hard cap on audit-log entries. When exceeded, oldest are dropped.
     * Default 500 ≈ 50 entries/hour for 10 hours of session work. */
    readonly maxAuditEntries: number;
    /** Hard cap on undo-stack depth. Older entries silently drop off the
     * bottom. Default 100 — beyond this the user is unlikely to remember
     * what they're undoing anyway. */
    readonly maxUndoStackDepth: number;
    /** Per-payload byte budget. Measured with `measurePayloadBytes`
     * (UTF-8 byte length of the JSON serialization). Handlers may declare
     * a smaller `payloadByteBudget`; if missing this is the fallback.
     * Default 4096 — fits typical UI state without dominating storage. */
    readonly maxPayloadBytes: number;
    /** How many times to let the user retry a failing invert before the
     * entry is auto-dropped. Default 3. */
    readonly maxInvertRetries: number;
    /** Kill switch — when false, dispatches still fire but nothing is
     * recorded or pushed onto the undo stack. Default true. */
    readonly enabled: boolean;
}

export const DEFAULT_ACTION_HISTORY_CONFIG: ActionHistoryConfig = Object.freeze({
    // ~50 entries/hour for a 10-hour session — plenty of history without
    // dominating localStorage. Override via `device.actionHistory` for
    // high-frequency apps.
    maxAuditEntries: 500,
    // Beyond ~100 the user is unlikely to remember what they're undoing;
    // also bounds the worst-case sessionStorage footprint.
    maxUndoStackDepth: 100,
    // Single-payload byte cap. Default keeps typical UI state (a file id,
    // a coordinate pair) easily under budget. Handlers may declare a
    // smaller `payloadByteBudget` for sensitive actions.
    maxPayloadBytes: 4096,
    // 3 retries before auto-drop matches what a frustrated user would do
    // manually before giving up.
    maxInvertRetries: 3,
    enabled: true
});

/**
 * Generic JSON-typed storage slot for the audit log. SettingsManager hands
 * a slot pointing into `device.auditLog` of the unified blob. Tests can
 * pass an in-memory slot. Mirrors `RecentActionsSlot`.
 */
export interface AuditLogSlot {
    get(): unknown;
    set(value: AuditEntry[]): void;
}

/**
 * Generic slot for the persisted history config (`device.actionHistory`).
 * Optional — when omitted the in-memory `DEFAULT_ACTION_HISTORY_CONFIG`
 * is used and no user override is possible.
 */
export interface ActionHistoryConfigSlot {
    get(): unknown;
    set(value: ActionHistoryConfig): void;
}

// =====================================================================
// Helpers — exported so HistoryPanel and tests can reuse them
// =====================================================================

/**
 * UTF-8 byte length of a JSON-serialized payload. Uses `Blob` because
 * `JSON.stringify().length` would return UTF-16 code units and undercount
 * multi-byte characters. Returns 0 for `undefined`.
 */
export const measurePayloadBytes = (payload: unknown): number => {
    if (payload === undefined) return 0;
    try {
        return new Blob([JSON.stringify(payload)]).size;
    } catch (error) {
        log.warn(`measurePayloadBytes failed to stringify payload`, error);
        return Number.POSITIVE_INFINITY;
    }
};

/**
 * Resolve an `ActionLabelDescriptor` to a display string. Looks up
 * `t.actions[labelKey]`; missing keys fall back to the literal `labelKey`
 * (developer is reminded by the visible raw id in the UI). `{placeholders}`
 * in the resolved string are replaced from `params`.
 *
 * The output is a plain string — React renders it escaped, so XSS via
 * untrusted param values is not possible from this path.
 */
export const formatActionLabel = (
    descriptor: ActionLabelDescriptor | undefined,
    translation: Translation | undefined
): string => {
    if (!descriptor) return ``;
    const raw =
        translation?.actions?.[descriptor.labelKey] ?? descriptor.labelKey;
    if (!descriptor.params) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, key: string) => {
        const value = descriptor.params?.[key];
        return value === undefined ? match : String(value);
    });
};

/**
 * Default toast emitter — uses `sonner` so it lands in the same toaster
 * the rest of the app uses. Tests inject a stub via the manager config.
 */
export type ActionToastFn = (
    severity: "info" | "warning" | "error",
    message: string
) => void;

const defaultToast: ActionToastFn = (severity, message) => {
    if (severity === `error`) {
        sonnerToast.error(message);
        return;
    }
    if (severity === `warning`) {
        sonnerToast.warning(message);
        return;
    }
    sonnerToast(message);
};

/**
 * Strings the manager itself needs at runtime (toasts). Apps pass them
 * from their translation; tests pass static fallbacks. Kept separate
 * from the global `Translation` interface so ActionManager can stay
 * decoupled from the React context.
 */
export interface ActionManagerToastStrings {
    /** Used as `undoFailed.replace("{error}", message)`. */
    readonly undoFailed: string;
    readonly undoNoHandler: string;
    /** Used as `undoDropped.replace("{n}", retries)`. */
    readonly undoDropped: string;
    readonly auditPersistenceDisabled: string;
}

const FALLBACK_TOAST_STRINGS: ActionManagerToastStrings = Object.freeze({
    undoFailed: `Could not undo: {error}`,
    undoNoHandler: `Cannot undo: action not available`,
    undoDropped: `Could not undo after {n} attempts; entry removed`,
    auditPersistenceDisabled: `Action history will not persist for this session due to storage quota`
});

// =====================================================================
// Existing action types — unchanged behaviour, signatures widened to
// allow `executeAction` to return `UndoableAction` for reversible actions.
// =====================================================================

/**
 * Alternate behaviour for an `Action` that activates under a particular
 * modifier-key combination. The classic case is morphing a "Move to bin"
 * affordance into "Delete permanently" while Shift is held.
 *
 * Resolution rule: `Action.variants` are evaluated in order and the first
 * matching variant wins. Place the most specific predicate first.
 */
export interface ActionVariant {
    /**
     * Predicate evaluated against the live modifier mask. Return `true` to
     * activate this variant. Predicates must be pure — they're called on
     * every modifier change while a menu is open.
     */
    when: (mods: ModifierMask) => boolean;
    /** Display override (see {@link ActionState.label}). */
    label?: string;
    icon?: () => JSX.Element;
    component?: () => JSX.Element;
    visibility?: ActionVisibility;
    disabledReasonText?: string;
    /**
     * Replacement handler. If omitted, the action's base `executeAction` is
     * used — handy when only the display should change.
     */
    execute?: (
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null
    ) => void | UndoableAction;
}

/**
 * Merged display + handler shape consumed by menu renderers. Always derived
 * from an `Action` via {@link resolveAction}; never constructed by hand.
 */
export interface ResolvedAction {
    readonly id: string;
    readonly category: string;
    readonly visibility: ActionVisibility;
    readonly disabledReasonText?: string;
    readonly icon?: () => JSX.Element;
    readonly label?: string;
    readonly component?: () => JSX.Element;
    readonly execute?: (
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null
    ) => void | UndoableAction;
    readonly children: ReadonlyArray<ResolvedAction>;
}

/**
 * Merge an `Action`'s base state, the first-matching variant for `mods`, and
 * its resolved children into a single flat `ResolvedAction`. This is the
 * only place modifier-aware behaviour lives — UI and dispatch both funnel
 * through it.
 */
export const resolveAction = (action: Action, mods: ModifierMask): ResolvedAction => {
    const handler = action.getCurrentHandler();
    const baseState: ActionState = handler?.getState() ?? {
        visibility: ActionVisibility.Hidden,
        disabledReasonText: handler ? undefined : `No handler defined`
    };
    const variant = handler?.variants?.find((v) => v.when(mods));
    const childActions = handler?.children?.(mods) ?? [];
    const resolvedChildren = childActions.map((child) => resolveAction(child, mods));
    return {
        id: action.id,
        category: action.category,
        visibility: variant?.visibility ?? baseState.visibility,
        disabledReasonText: variant?.disabledReasonText ?? baseState.disabledReasonText,
        icon: variant?.icon ?? baseState.icon,
        label: variant?.label ?? baseState.label,
        component: variant?.component ?? baseState.component,
        execute: variant?.execute ?? handler?.executeAction,
        children: resolvedChildren
    };
};

export interface ActionConstructorParams {
    id: string;
    category: string;
    actionHandlers?: Map<string, ActionHandler>;
    hideInCommandPalette?: boolean;
    doNotTrackUsage?: boolean;
}

export class Action {
    id: string;
    category: string;
    actionHandlers: Map<string, ActionHandler>;
    hideInCommandPalette?: boolean;
    doNotTrackUsage?: boolean;

    constructor(params: ActionConstructorParams) {
        this.id = params.id;
        this.category = params.category;
        this.actionHandlers = params.actionHandlers ?? new Map();
        this.hideInCommandPalette = params.hideInCommandPalette ?? false;
        this.doNotTrackUsage = params.doNotTrackUsage ?? false;
    }

    getCurrentHandler = (): ActionHandler | undefined => {
        return this.actionHandlers.entries().next().value?.[1];
    };

    getState = (): ActionState => {
        const handler = this.getCurrentHandler();
        if (!handler) {
            log.warn(`No handler defined for action: ${this.id}`);
            return { visibility: ActionVisibility.Hidden, disabledReasonText: `No handler defined` };
        }
        if (!handler.executeAction) {
            log.warn(`No executeAction function defined for action: ${this.id}`);
            return {
                visibility: ActionVisibility.Hidden,
                disabledReasonText: `No executeAction function defined`
            };
        }

        return handler.getState();
    };
}

export interface ActionHandler {
    id: string;
    scopes?: string[];
    executeAction?: (
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null,
        /** Optional caller-supplied payload — forwarded by
         * `ActionManager.dispatchAction(actionId, event, scopeElement, payload)`
         * and again by the redo path when re-applying a captured
         * `forwardPayload`. Read-only actions ignore this. */
        payload?: unknown
    ) => void | UndoableAction;
    /** Reverses a previous dispatch. Receives the `inversePayload` captured
     * at dispatch time. Sync or async — async errors propagate through the
     * standard failure path (toast + log + retry). */
    invertAction?: (inversePayload: unknown) => void | Promise<void>;
    getState: () => ActionState;
    variants?: ReadonlyArray<ActionVariant>;
    children?: (mods: ModifierMask) => Action[];
    /** Per-handler payload byte budget. Set to 0 to opt out of payload
     * persistence entirely (entry still logged with `payloadDropped:
     * "opt-out"`). Falls back to `ActionHistoryConfig.maxPayloadBytes`. */
    readonly payloadByteBudget?: number;
    /** When true, the audit-log entry is created without a payload
     * (`payloadDropped: "opt-out"`). Use for actions whose payload may
     * contain credentials, tokens, file contents, or PII. */
    readonly excludeFromAuditPayload?: boolean;
    /** When true, NO undo-stack entry is created even if `executeAction`
     * returns an `UndoableAction`. Use for sensitive irreversible actions
     * ("Delete account"). */
    readonly excludeFromUndoStack?: boolean;
}

export interface RecentAction {
    actionId: string;
    timestamp: number;
}

export interface RecentActionsSlot {
    get(): unknown;
    set(value: RecentAction[]): void;
}

/** Subset of the surface needed by ActionManager. */
export type ActionManagerConfig =
    | (BaseActionManagerConfig & {
          readonly recentActionsSlot: RecentActionsSlot;
          readonly recentActionsStorageKey?: never;
      })
    | (BaseActionManagerConfig & {
          /** @deprecated Use `recentActionsSlot`. */
          readonly recentActionsStorageKey: string;
          readonly recentActionsSlot?: never;
      });

interface BaseActionManagerConfig {
    readonly maxRecentActions: number;
    /** Storage slot for the persisted audit log. Optional — when omitted
     * the log is in-memory only (lost on reload). */
    readonly auditLogSlot?: AuditLogSlot;
    /** Storage slot for the persisted history config. Optional — when
     * omitted, `DEFAULT_ACTION_HISTORY_CONFIG` is used. */
    readonly historyConfigSlot?: ActionHistoryConfigSlot;
    /** UndoStackManager instance — owns sessionStorage-backed undo persistence.
     * Optional — when omitted, undo is in-memory only. */
    readonly undoStackManager?: UndoStackManager;
    /** Override the default sonner-backed toast. Tests inject a stub. */
    readonly toast?: ActionToastFn;
    /** Resolver for runtime toast strings. Apps pass `() => mowsContext.t.actions`
     * so toast text is localized; tests pass a static object. */
    readonly toastStrings?: () => ActionManagerToastStrings;
    /** Synchronous callback fired after each audit-log entry is appended +
     * persisted. Errors are caught + logged, never propagated. */
    readonly onAuditEntry?: (entry: AuditEntry) => void;
}

/**
 * Per-tab identifier. Stored in sessionStorage so it survives reloads in
 * the same tab but is unique per tab. UUID-shaped (no external dep).
 */
const TAB_ID_SESSION_KEY = `mows_actionManager_tabId`;
const generateTabId = (): string => {
    if (typeof sessionStorage !== `undefined`) {
        try {
            const existing = sessionStorage.getItem(TAB_ID_SESSION_KEY);
            if (existing) return existing;
            const fresh = generateRandomId();
            sessionStorage.setItem(TAB_ID_SESSION_KEY, fresh);
            return fresh;
        } catch {
            // sessionStorage may throw in private browsing — fall through.
        }
    }
    return generateRandomId();
};

const generateRandomId = (): string => {
    if (typeof crypto !== `undefined` && typeof crypto.randomUUID === `function`) {
        return crypto.randomUUID();
    }
    // Last-resort fallback — collision is extremely unlikely for tab ids.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export class ActionManager {
    private actions: Map<string, Action> = new Map();
    private recentActions: RecentAction[] = [];
    private config: ActionManagerConfig;
    private slot: RecentActionsSlot;
    private auditLogSlot: AuditLogSlot | undefined;
    private historyConfigSlot: ActionHistoryConfigSlot | undefined;
    private undoStackManager: UndoStackManager | undefined;
    private toast: ActionToastFn;
    private toastStringsFn: () => ActionManagerToastStrings;

    // ---- Audit log + undo state ----
    private auditLog: AuditEntry[] = [];
    private historyConfig: ActionHistoryConfig = DEFAULT_ACTION_HISTORY_CONFIG;
    // Redo stack lives in UndoStackManager too (since the persisted-redo
    // change) — survives reload within the same tab. Cleared by
    // `clearRedoStack` on any new undoable dispatch.
    private pendingInverts: Map<string, Promise<void>> = new Map();
    private activeTransactionGroupId: string | null = null;
    private auditPersistenceDisabled = false;
    private auditEntryCounter = 0;
    private readonly _tabId: string;
    private subscribers: Set<() => void> = new Set();

    constructor(config: ActionManagerConfig) {
        this.config = config;
        this.slot = resolveRecentActionsSlot(config);
        this.auditLogSlot = config.auditLogSlot;
        this.historyConfigSlot = config.historyConfigSlot;
        this.undoStackManager = config.undoStackManager;
        this.toast = config.toast ?? defaultToast;
        this.toastStringsFn = config.toastStrings ?? (() => FALLBACK_TOAST_STRINGS);
        this._tabId = generateTabId();
        this.loadHistoryConfig();
        this.loadAuditLog();
    }

    get tabId(): string {
        return this._tabId;
    }

    dispatchAction = (
        actionId: string,
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null,
        payload?: unknown
    ): void => {
        const action = this.actions.get(actionId);

        if (!action) {
            log.warn(`Action not found: ${actionId}`);
            return;
        }

        log.debug(`Dispatching action: ${actionId}`);
        const resolved = resolveAction(action, modifierMaskFromEvent(event));
        if (!resolved.execute) {
            log.warn(`No executable handler for action: ${actionId}`);
            return;
        }

        this.trackCommandUsage(action);

        // Capture the return value: undefined for read-only actions,
        // an UndoableAction for reversible ones. The forward call uses
        // the resolved execute (which already accounts for variants);
        // the inverse uses the base handler's invertAction.
        let result: void | UndoableAction;
        try {
            result = (resolved.execute as (
                e?: KeyboardEvent | MouseEvent,
                s?: HTMLElement | null,
                p?: unknown
            ) => void | UndoableAction)(event, scopeElement, payload);
        } catch (error) {
            log.error(`Forward handler threw for action ${actionId}`, error);
            throw error;
        }

        this.recordDispatch({
            actionId,
            category: action.category,
            modifiers: modifierMaskFromEvent(event),
            handler: action.getCurrentHandler(),
            undoable: result
        });
    };

    /**
     * Build + persist the audit entry; conditionally push to the undo
     * stack. Split out from `dispatchAction` so it can be exercised
     * independently in tests and so the dispatch path stays narrow.
     */
    private recordDispatch(info: {
        actionId: string;
        category: string;
        modifiers: ModifierMask;
        handler: ActionHandler | undefined;
        undoable: void | UndoableAction;
    }): void {
        if (!this.historyConfig.enabled) return;

        const { actionId, category, modifiers, handler, undoable } = info;
        const optOut = handler?.excludeFromAuditPayload === true;
        const excludeFromUndo = handler?.excludeFromUndoStack === true;
        const budget =
            handler?.payloadByteBudget ?? this.historyConfig.maxPayloadBytes;

        const auditPayload = undoable ? undoable.forwardPayload : undefined;
        const payloadBytes = measurePayloadBytes(auditPayload);
        const oversize = payloadBytes > budget;

        const entryUndoable =
            !!undoable && !excludeFromUndo && !oversize;

        const entry: AuditEntry = {
            id: this.nextEntryId(),
            actionId,
            category,
            timestamp: Date.now(),
            tabId: this._tabId,
            payload: optOut || oversize ? undefined : auditPayload,
            payloadDropped: optOut
                ? `opt-out`
                : oversize
                  ? `oversize`
                  : undefined,
            modifiers,
            undoable: entryUndoable,
            transactionGroupId: undoable?.transactionGroupId ?? this.activeTransactionGroupId ?? undefined,
            redoable: false
        };

        if (oversize) {
            log.warn(
                `Action ${actionId} payload (${payloadBytes} bytes) exceeded budget ${budget}; entry recorded without payload and no undo entry created`
            );
        }

        this.appendAudit(entry);

        if (entryUndoable && undoable) {
            const undoEntry: UndoableAction = {
                ...undoable,
                // Force the undo entry to share an id with its audit entry —
                // when audit rotation drops oldest entries we use that id to
                // drop the matching undo entries and avoid dangling refs.
                // Any id the handler put on `UndoableAction` is ignored here.
                id: entry.id,
                actionId,
                timestamp: undoable.timestamp || entry.timestamp,
                transactionGroupId:
                    undoable.transactionGroupId ?? this.activeTransactionGroupId ?? undefined,
                invertRetries: 0
            };
            this.pushUndo(undoEntry);
            this.clearRedoStack();
        }

        this.notifySubscribers();
    }

    /**
     * Append an entry, rotate if over cap, persist. If persistence raises a
     * quota error, drop oldest 50% in one eviction; if still failing, mark
     * persistence disabled for the session and toast once.
     */
    private appendAudit(entry: AuditEntry): void {
        this.auditLog = [...this.auditLog, entry];
        if (this.auditLog.length > this.historyConfig.maxAuditEntries) {
            const overflow = this.auditLog.length - this.historyConfig.maxAuditEntries;
            const dropped = this.auditLog.slice(0, overflow);
            this.auditLog = this.auditLog.slice(overflow);
            this.dropUndoEntriesByAuditIds(dropped.map((entry) => entry.id));
        }
        this.persistAuditLog();
        if (this.config.onAuditEntry) {
            try {
                this.config.onAuditEntry(entry);
            } catch (error) {
                log.warn(`onAuditEntry subscriber threw; continuing`, error);
            }
        }
    }

    private persistAuditLog(): void {
        if (!this.auditLogSlot || this.auditPersistenceDisabled) return;
        try {
            this.auditLogSlot.set(this.auditLog);
        } catch (error) {
            if (isQuotaError(error)) {
                const half = Math.floor(this.auditLog.length / 2);
                const dropped = this.auditLog.slice(0, half);
                this.auditLog = this.auditLog.slice(half);
                this.dropUndoEntriesByAuditIds(dropped.map((entry) => entry.id));
                try {
                    this.auditLogSlot.set(this.auditLog);
                    log.warn(
                        `Audit log quota exceeded; dropped oldest ${half} entries to recover`
                    );
                    return;
                } catch (retryError) {
                    this.auditPersistenceDisabled = true;
                    log.warn(
                        `Audit log quota exceeded after eviction; persistence disabled for this session`,
                        retryError
                    );
                    this.toast(`warning`, this.toastStringsFn().auditPersistenceDisabled);
                    return;
                }
            }
            log.warn(`Failed to persist audit log`, error);
        }
    }

    private dropUndoEntriesByAuditIds(droppedAuditIds: string[]): void {
        if (!this.undoStackManager || droppedAuditIds.length === 0) return;
        const droppedSet = new Set(droppedAuditIds);
        const remaining = this.undoStackManager
            .getStack()
            .filter((entry) => !droppedSet.has(entry.id));
        this.undoStackManager.replace(remaining);
    }

    private pushUndo(entry: UndoableAction): void {
        if (!this.undoStackManager) return;
        const current = this.undoStackManager.getStack();
        let next = [...current, entry];
        if (next.length > this.historyConfig.maxUndoStackDepth) {
            next = next.slice(next.length - this.historyConfig.maxUndoStackDepth);
        }
        this.undoStackManager.replace(next);
    }

    private clearRedoStack(): void {
        if (!this.undoStackManager) return;
        if (this.undoStackManager.getRedoStack().length === 0) return;
        this.undoStackManager.replaceRedo([]);
    }

    /** Generate a monotonically-increasing-per-tab unique entry id. The
     * `performance.now()` prefix sorts naturally; the counter breaks ties
     * within the same microtask; tabId disambiguates cross-tab merges. */
    private nextEntryId(): string {
        this.auditEntryCounter += 1;
        const time = typeof performance !== `undefined` ? performance.now() : Date.now();
        return `${time.toString(36)}-${this._tabId.slice(0, 8)}-${this.auditEntryCounter}`;
    }

    // ---- Undo / redo / transactions --------------------------------

    /**
     * Pop the most recent undoable entry (or the most recent transaction
     * group) and call its handler's `invertAction`. Idempotent against
     * spamming via the single-flight lock. Async errors flow through the
     * standard failure path.
     */
    undo = async (): Promise<void> => {
        if (!this.undoStackManager) {
            log.warn(`undo called but no UndoStackManager wired into ActionManager`);
            return;
        }
        const stack = this.undoStackManager.getStack();
        if (stack.length === 0) return;

        const top = stack[stack.length - 1]!;
        const groupId = top.transactionGroupId;
        // If the top entry is in a transaction, pop the whole consecutive group
        // (which the dispatch loop guarantees is contiguous).
        const groupEntries: UndoableAction[] = [];
        for (let i = stack.length - 1; i >= 0; i -= 1) {
            const entry = stack[i]!;
            if (entry.transactionGroupId === groupId && groupId !== undefined) {
                groupEntries.unshift(entry);
            } else if (groupId === undefined && i === stack.length - 1) {
                groupEntries.unshift(entry);
                break;
            } else {
                break;
            }
        }

        // Single-flight per actionId — but for a transaction we lock on the
        // group key so spamming Ctrl+Z during a multi-step undo doesn't
        // race itself.
        const lockKey = groupId ?? top.actionId;
        if (this.pendingInverts.has(lockKey)) {
            log.debug(`Undo for ${lockKey} already in flight; ignoring`);
            return;
        }

        const promise = this.runInverts(groupEntries, stack, groupEntries.length).finally(
            () => {
                this.pendingInverts.delete(lockKey);
                this.notifySubscribers();
            }
        );
        this.pendingInverts.set(lockKey, promise);
        await promise;
    };

    private runInverts = async (
        entries: UndoableAction[],
        stackSnapshot: UndoableAction[],
        popCount: number
    ): Promise<void> => {
        if (!this.undoStackManager) return;
        // Invert in reverse order — most recent applied first.
        const reverse = [...entries].reverse();
        for (const entry of reverse) {
            const action = this.actions.get(entry.actionId);
            const handler = action?.getCurrentHandler();
            if (!handler || !handler.invertAction) {
                this.toast(`error`, this.toastStringsFn().undoNoHandler);
                log.warn(`No invertAction registered for ${entry.actionId}; dropping entry`);
                this.removeFromStack(entry.id);
                return;
            }
            try {
                await handler.invertAction(entry.inversePayload);
            } catch (error) {
                log.error(`invertAction threw for ${entry.actionId}`, error);
                const retries = (entry.invertRetries ?? 0) + 1;
                const message = error instanceof Error ? error.message : String(error);
                if (retries >= this.historyConfig.maxInvertRetries) {
                    this.toast(
                        `error`,
                        this.toastStringsFn().undoDropped.replace(`{n}`, String(retries))
                    );
                    this.removeFromStack(entry.id);
                } else {
                    entry.invertRetries = retries;
                    // Persist the bumped retry counter — `stackSnapshot`
                    // shares object references with the persisted entry,
                    // but UndoStackManager.getStack() deserializes on every
                    // read, so the mutation must be written back to be
                    // visible on the next undo attempt.
                    this.undoStackManager.replace(stackSnapshot);
                    this.toast(
                        `error`,
                        this.toastStringsFn().undoFailed.replace(`{error}`, message)
                    );
                }
                return;
            }
        }
        // Success — pop the entries off the stack, move onto redo.
        const newStack = stackSnapshot.slice(0, stackSnapshot.length - popCount);
        this.undoStackManager.replace(newStack);
        let nextRedo = [...this.undoStackManager.getRedoStack(), ...entries];
        if (nextRedo.length > this.historyConfig.maxUndoStackDepth) {
            nextRedo = nextRedo.slice(nextRedo.length - this.historyConfig.maxUndoStackDepth);
        }
        this.undoStackManager.replaceRedo(nextRedo);
    };

    redo = async (): Promise<void> => {
        if (!this.undoStackManager) return;
        const redoStack = this.undoStackManager.getRedoStack();
        if (redoStack.length === 0) return;
        const top = redoStack[redoStack.length - 1]!;
        const groupId = top.transactionGroupId;
        const groupEntries: UndoableAction[] = [];
        for (let i = redoStack.length - 1; i >= 0; i -= 1) {
            const entry = redoStack[i]!;
            if (entry.transactionGroupId === groupId && groupId !== undefined) {
                groupEntries.unshift(entry);
            } else if (groupId === undefined && i === redoStack.length - 1) {
                groupEntries.unshift(entry);
                break;
            } else {
                break;
            }
        }

        const lockKey = `redo:${groupId ?? top.actionId}`;
        if (this.pendingInverts.has(lockKey)) {
            log.debug(`Redo for ${lockKey} already in flight; ignoring`);
            return;
        }

        const promise = this.applyRedo(groupEntries, redoStack).finally(() => {
            this.pendingInverts.delete(lockKey);
            this.notifySubscribers();
        });
        this.pendingInverts.set(lockKey, promise);
        await promise;
    };

    private applyRedo = async (
        entries: UndoableAction[],
        redoSnapshot: ReadonlyArray<UndoableAction>
    ): Promise<void> => {
        if (!this.undoStackManager) return;
        // Re-apply by re-dispatching the forward call. v1 uses the same
        // forward handler — apps that need a custom redo path should keep
        // their handler idempotent against the forward payload.
        for (const entry of entries) {
            const action = this.actions.get(entry.actionId);
            const handler = action?.getCurrentHandler();
            if (!handler?.executeAction) {
                this.toast(`error`, this.toastStringsFn().undoNoHandler);
                log.warn(`No executeAction registered for redo of ${entry.actionId}`);
                return;
            }
            try {
                handler.executeAction(undefined, null, entry.forwardPayload);
            } catch (error) {
                log.error(`redo executeAction threw for ${entry.actionId}`, error);
                this.toast(
                    `error`,
                    this.toastStringsFn().undoFailed.replace(
                        `{error}`,
                        error instanceof Error ? error.message : String(error)
                    )
                );
                return;
            }
        }
        // Move entries back onto the undo stack and out of redo.
        const trimmedRedo = redoSnapshot.slice(0, redoSnapshot.length - entries.length);
        this.undoStackManager.replaceRedo([...trimmedRedo]);
        for (const entry of entries) {
            this.pushUndo({ ...entry, invertRetries: 0 });
        }
    };

    private removeFromStack(entryId: string): void {
        if (!this.undoStackManager) return;
        const filtered = this.undoStackManager
            .getStack()
            .filter((entry) => entry.id !== entryId);
        this.undoStackManager.replace(filtered);
    }

    /**
     * Open a transaction — every undoable action dispatched between this
     * call and the matching `endTransaction` gets the same
     * `transactionGroupId`. Undo pops the whole group as one operation.
     *
     * Does not nest. A nested `beginTransaction` overwrites the active
     * group key; `endTransaction` only clears it when the keys match.
     */
    beginTransaction = (groupKey: string): void => {
        if (this.activeTransactionGroupId !== null) {
            log.warn(
                `beginTransaction(${groupKey}) called while transaction ${this.activeTransactionGroupId} is open; overwriting`
            );
        }
        this.activeTransactionGroupId = groupKey;
    };

    endTransaction = (groupKey: string): void => {
        if (this.activeTransactionGroupId !== groupKey) {
            log.warn(
                `endTransaction(${groupKey}) called but active transaction is ${this.activeTransactionGroupId ?? `none`}`
            );
            return;
        }
        this.activeTransactionGroupId = null;
    };

    isInvertInFlight = (actionId?: string): boolean => {
        if (actionId === undefined) return this.pendingInverts.size > 0;
        return (
            this.pendingInverts.has(actionId) ||
            this.pendingInverts.has(`redo:${actionId}`)
        );
    };

    // ---- History panel + analytics surface ------------------------------

    getAuditLog = (): ReadonlyArray<AuditEntry> => this.auditLog;
    getUndoStack = (): ReadonlyArray<UndoableAction> =>
        this.undoStackManager?.getStack() ?? [];
    getRedoStack = (): ReadonlyArray<UndoableAction> =>
        this.undoStackManager?.getRedoStack() ?? [];
    getHistoryConfig = (): ActionHistoryConfig => this.historyConfig;

    /** Deep clone of the audit log so callers can mutate freely (e.g. to
     * shape it into an analytics payload). */
    exportAuditLog = (): AuditEntry[] => JSON.parse(JSON.stringify(this.auditLog));

    /** Clear audit log + undo/redo stacks. Used by the "Clear history"
     * affordance in HistoryPanel. */
    clearHistory = (): void => {
        this.auditLog = [];
        this.persistAuditLog();
        this.undoStackManager?.clear();
        this.notifySubscribers();
    };

    /** Subscribe to any change in audit log / undo stack / redo stack /
     * in-flight set. HistoryPanel uses this to re-render without polling. */
    subscribe = (listener: () => void): (() => void) => {
        this.subscribers.add(listener);
        return () => {
            this.subscribers.delete(listener);
        };
    };

    private notifySubscribers(): void {
        for (const listener of Array.from(this.subscribers)) {
            try {
                listener();
            } catch (error) {
                log.warn(`ActionManager subscriber threw; continuing`, error);
            }
        }
    }

    // ---- Existing action management surface (unchanged) -----------------

    getAction = (actionId: string): Action | undefined => {
        return this.actions.get(actionId);
    };

    defineAction(action: Action): void {
        log.debug(`Defining action: ${action.id}`, action);
        this.actions.set(action.id, action);
    }

    defineMultipleActions(actions: Action[]): void {
        actions.forEach((action) => this.defineAction(action));
    }

    getActionHandlersByScope = (scope: string): ActionHandler[] => {
        const handlers: ActionHandler[] = [];
        this.actions.forEach((action) => {
            action.actionHandlers.forEach((handler) => {
                if (handler.scopes?.includes(scope)) {
                    handlers.push(handler);
                }
            });
        });
        return handlers;
    };

    getActionsByHandlerScope = (scope: string): Action[] => {
        const actions: Action[] = [];
        this.actions.forEach((action) => {
            action.actionHandlers.forEach((handler) => {
                if (handler.scopes?.includes(scope)) {
                    actions.push(action);
                }
            });
        });
        return actions;
    };

    getAllActions = (): Map<string, Action> => {
        return this.actions;
    };

    getActionsByCategory = (category: string): Action[] => {
        return Array.from(this.actions.values()).filter((action) => action.category === category);
    };

    getCategories = (): string[] => {
        const categories = new Set<string>();
        this.actions.forEach((action) => categories.add(action.category));
        return Array.from(categories).sort();
    };

    registerActionHandler = (actionId: string, actionHandler: ActionHandler): void => {
        log.debug(`Setting handler for action: ${actionId}`);
        const existingAction = this.actions.get(actionId);

        if (existingAction) {
            const existingActionHandler = existingAction.actionHandlers.get(actionHandler.id);

            if (existingActionHandler) {
                log.warn(
                    `Action handler already registered for action: ${actionId} with handler ID: ${actionHandler.id}`
                );
                return;
            }
            this.actions.set(actionId, {
                ...existingAction,
                actionHandlers: existingAction.actionHandlers.set(actionHandler.id, actionHandler)
            });
        }
    };

    unregisterActionHandler = (actionId: string, actionHandlerId: string): void => {
        log.debug(`Unsetting handler for action: ${actionId}`);
        const existingAction = this.actions.get(actionId);

        if (existingAction) {
            const existingActionHandler = existingAction.actionHandlers.get(actionHandlerId);

            if (!existingActionHandler) {
                log.warn(
                    `No action handler found for action: ${actionId} with handler ID: ${actionHandlerId}`
                );
                return;
            }

            existingAction.actionHandlers.delete(actionHandlerId);
        }
    };

    trackCommandUsage = (action: Action): void => {
        log.debug(`trackCommandUsage called for action: ${action.id}`);
        if (action.doNotTrackUsage) {
            log.debug(`Not tracking usage for action: ${action.id} (doNotTrackUsage is true)`);
            return;
        }
        const recentCommands = this.getRecentCommands();
        const now = Date.now();
        const updatedCommands = [
            { actionId: action.id, timestamp: now },
            ...recentCommands.filter((command) => command.actionId !== action.id)
        ].slice(0, this.config.maxRecentActions);
        this.recentActions = updatedCommands;
        this.saveRecentActions();
    };

    loadRecentActions = () => {
        const stored = this.slot.get();
        if (!stored) {
            this.recentActions = [];
            return;
        }
        if (!Array.isArray(stored)) {
            log.warn(
                `Stored recent actions value is not an array; ignoring and starting fresh`
            );
            this.recentActions = [];
            return;
        }
        this.recentActions = stored as RecentAction[];
    };

    saveRecentActions = () => {
        this.slot.set(this.recentActions);
    };

    getRecentCommands = (): RecentAction[] => {
        return this.recentActions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, this.config.maxRecentActions);
    };

    // ---- Audit/history-config persistence -----------------------------

    private loadHistoryConfig(): void {
        if (!this.historyConfigSlot) {
            this.historyConfig = DEFAULT_ACTION_HISTORY_CONFIG;
            return;
        }
        const stored = this.historyConfigSlot.get();
        if (!stored || typeof stored !== `object` || Array.isArray(stored)) {
            this.historyConfig = DEFAULT_ACTION_HISTORY_CONFIG;
            return;
        }
        // Defensive merge — accept any subset of the config keys, fall back
        // to defaults for missing/invalid ones.
        const partial = stored as Partial<ActionHistoryConfig>;
        this.historyConfig = {
            maxAuditEntries:
                typeof partial.maxAuditEntries === `number` && partial.maxAuditEntries > 0
                    ? partial.maxAuditEntries
                    : DEFAULT_ACTION_HISTORY_CONFIG.maxAuditEntries,
            maxUndoStackDepth:
                typeof partial.maxUndoStackDepth === `number` && partial.maxUndoStackDepth > 0
                    ? partial.maxUndoStackDepth
                    : DEFAULT_ACTION_HISTORY_CONFIG.maxUndoStackDepth,
            maxPayloadBytes:
                typeof partial.maxPayloadBytes === `number` && partial.maxPayloadBytes >= 0
                    ? partial.maxPayloadBytes
                    : DEFAULT_ACTION_HISTORY_CONFIG.maxPayloadBytes,
            maxInvertRetries:
                typeof partial.maxInvertRetries === `number` && partial.maxInvertRetries > 0
                    ? partial.maxInvertRetries
                    : DEFAULT_ACTION_HISTORY_CONFIG.maxInvertRetries,
            enabled:
                typeof partial.enabled === `boolean`
                    ? partial.enabled
                    : DEFAULT_ACTION_HISTORY_CONFIG.enabled
        };
    }

    setHistoryConfig = (next: Partial<ActionHistoryConfig>): void => {
        this.historyConfig = { ...this.historyConfig, ...next };
        this.historyConfigSlot?.set(this.historyConfig);
        this.notifySubscribers();
    };

    private loadAuditLog(): void {
        if (!this.auditLogSlot) return;
        const stored = this.auditLogSlot.get();
        if (!stored) return;
        if (!Array.isArray(stored)) {
            log.warn(`Stored audit log is not an array; starting fresh`);
            return;
        }
        // Defensive: drop entries missing the required shape rather than
        // crash the panel render later. A user pasting a malformed settings
        // JSON or a half-corrupted localStorage value won't poison the log.
        const sanitized: AuditEntry[] = [];
        for (const candidate of stored as unknown[]) {
            if (
                candidate &&
                typeof candidate === `object` &&
                typeof (candidate as AuditEntry).actionId === `string` &&
                typeof (candidate as AuditEntry).timestamp === `number` &&
                typeof (candidate as AuditEntry).id === `string`
            ) {
                sanitized.push(candidate as AuditEntry);
            }
        }
        if (sanitized.length !== stored.length) {
            log.warn(
                `Dropped ${stored.length - sanitized.length} malformed audit log entries on load`
            );
        }
        this.auditLog = sanitized;
    }
}

const resolveRecentActionsSlot = (config: ActionManagerConfig): RecentActionsSlot => {
    if (config.recentActionsSlot && config.recentActionsStorageKey) {
        // The discriminated union prevents this at compile time but a
        // JS caller (or an `as any` cast) can still bypass it.
        throw new Error(
            `ActionManager: provide either recentActionsSlot OR recentActionsStorageKey, not both`
        );
    }
    if (config.recentActionsSlot) return config.recentActionsSlot;
    if (config.recentActionsStorageKey) {
        const key = config.recentActionsStorageKey;
        return {
            get: () => {
                const raw = localStorage.getItem(key);
                if (!raw) return undefined;
                try {
                    return JSON.parse(raw) as unknown;
                } catch (e) {
                    log.error(`Failed to parse recent actions from localStorage at ${key}`, e);
                    return undefined;
                }
            },
            set: (value) => {
                localStorage.setItem(key, JSON.stringify(value));
            }
        };
    }
    throw new Error(
        `ActionManager requires either recentActionsSlot or recentActionsStorageKey in its config`
    );
};

/**
 * Browsers throw `DOMException("QuotaExceededError")` (Chrome/Firefox)
 * or a similar quota-related error from `Storage.setItem` when the
 * origin's localStorage quota is exhausted. We detect by error name OR
 * known message fragments — names vary by engine.
 */
const isQuotaError = (error: unknown): boolean => {
    if (!error) return false;
    if (typeof DOMException !== `undefined` && error instanceof DOMException) {
        if (
            error.name === `QuotaExceededError` ||
            error.name === `NS_ERROR_DOM_QUOTA_REACHED`
        ) {
            return true;
        }
    }
    const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes(`quota`);
};
