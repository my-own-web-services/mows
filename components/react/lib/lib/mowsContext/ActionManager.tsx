import { JSX } from "react";
import { log } from "../logging";

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

/**
 * Alternate behaviour for an `Action` that activates under a particular
 * modifier-key combination. The classic case is morphing a "Move to bin"
 * affordance into "Delete permanently" while Shift is held.
 *
 * Resolution rule: `Action.variants` are evaluated in order and the first
 * matching variant wins. Place the most specific predicate first.
 *
 * @example
 * ```ts
 * {
 *     when: (mods) => mods.shift,
 *     label: 'Delete permanently',
 *     icon: () => <TrashX />,
 *     execute: (event) => permanentlyDelete(event),
 * }
 * ```
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
     * used — handy when only the display should change. The second arg is
     * the element the user originally interacted with (for context-menu
     * dispatch, the right-clicked element — *not* the menu item). Handlers
     * read `data-*` off this element to identify which row / list / scope
     * the action should target.
     */
    execute?: (
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null
    ) => void;
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
    /**
     * The handler to invoke when the user clicks / presses Enter. May be
     * `undefined` if the action has no executable handler at all (e.g. a
     * pure submenu container). Receives the triggering event plus the
     * element the action was *aimed at* — for context-menu dispatch this
     * is the right-clicked element, not the menu item the user clicked.
     */
    readonly execute?: (
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null
    ) => void;
    /**
     * Children of this action, already-resolved. Non-empty when the
     * underlying handler declared a `children` resolver. Renderers should
     * present an `Action` with children as a submenu trigger.
     */
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
        scopeElement?: HTMLElement | null
    ) => void;
    getState: () => ActionState;
    /**
     * Modifier-keyed alternates. Evaluated in order; first match wins.
     * See {@link ActionVariant}.
     */
    variants?: ReadonlyArray<ActionVariant>;
    /**
     * Lazy submenu resolver. Called when a menu renderer asks for this
     * action's children. The function receives the live modifier mask so
     * submenu contents can depend on Shift / Alt / etc. just like top-level
     * variants do.
     */
    children?: (mods: ModifierMask) => Action[];
}

export interface RecentAction {
    actionId: string;
    timestamp: number;
}

export interface ActionManagerConfig {
    recentActionsStorageKey: string;
    maxRecentActions: number;
}

export class ActionManager {
    private actions: Map<string, Action> = new Map();
    private recentActions: RecentAction[] = [];
    private config: ActionManagerConfig;

    constructor(config: ActionManagerConfig) {
        this.config = config;
    }

    dispatchAction = (
        actionId: string,
        event?: KeyboardEvent | MouseEvent,
        scopeElement?: HTMLElement | null
    ) => {
        const action = this.actions.get(actionId);

        if (!action) {
            log.warn(`Action not found: ${actionId}`);
            return;
        }

        log.debug(`Dispatching action: ${actionId}`);
        // Resolve against the modifier mask of the actual triggering event so
        // a Shift-held click executes the Shift variant — not whatever the
        // user was holding when the menu was opened.
        const resolved = resolveAction(action, modifierMaskFromEvent(event));
        if (!resolved.execute) {
            log.warn(`No executable handler for action: ${actionId}`);
            return;
        }

        this.trackCommandUsage(action);
        resolved.execute(event, scopeElement);
    };

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
        log.debug(`Action retrieved for tracking:`, action);
        if (action.doNotTrackUsage) {
            log.debug(`Not tracking usage for action: ${action.id} (doNotTrackUsage is true)`);
            return;
        }
        log.debug(`Tracking usage for action: ${action.id}`);
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
        const stored = localStorage.getItem(this.config.recentActionsStorageKey);
        if (stored) {
            try {
                this.recentActions = JSON.parse(stored) as RecentAction[];
            } catch (e) {
                log.error(`Failed to parse recent actions from localStorage`, e);
                this.recentActions = [];
            }
        } else {
            this.recentActions = [];
        }
    };

    saveRecentActions = () => {
        localStorage.setItem(
            this.config.recentActionsStorageKey,
            JSON.stringify(this.recentActions)
        );
    };

    getRecentCommands = (): RecentAction[] => {
        return this.recentActions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, this.config.maxRecentActions);
    };
}
