import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Action,
    ActionManager,
    ActionVisibility,
    DEFAULT_ACTION_HISTORY_CONFIG,
    formatActionLabel,
    measurePayloadBytes,
    modifierMaskFromEvent,
    NO_MODIFIERS,
    resolveAction,
    type ActionHandler,
    type AuditEntry,
    type AuditLogSlot,
    type ActionHistoryConfig,
    type ActionHistoryConfigSlot,
    type ActionToastFn,
    type ActionManagerToastStrings,
    type ModifierMask,
    type UndoableAction
} from "./ActionManager";
import { UndoStackManager, type UndoStackStorageAdapter } from "./UndoStackManager";

const makeAction = (
    id: string,
    handler: Omit<ActionHandler, `id` | `scopes`> & Partial<Pick<ActionHandler, `id` | `scopes`>>
): Action =>
    new Action({
        id,
        category: `test`,
        actionHandlers: new Map([
            [
                handler.id ?? `default`,
                {
                    id: handler.id ?? `default`,
                    scopes: handler.scopes ?? [`row`],
                    getState: handler.getState,
                    executeAction: handler.executeAction,
                    variants: handler.variants,
                    children: handler.children
                }
            ]
        ])
    });

describe(`resolveAction`, () => {
    it(`falls back to the base handler state when no variants match`, () => {
        const action = makeAction(`x`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: vi.fn()
        });
        const resolved = resolveAction(action, NO_MODIFIERS);
        expect(resolved.visibility).toBe(ActionVisibility.Shown);
        expect(resolved.execute).toBeTypeOf(`function`);
        expect(resolved.children).toEqual([]);
    });

    it(`picks the first matching variant`, () => {
        const base = vi.fn();
        const shiftExec = vi.fn();
        const altExec = vi.fn();
        const action = makeAction(`del`, {
            getState: () => ({ visibility: ActionVisibility.Shown, label: `Move to bin` }),
            executeAction: base,
            variants: [
                {
                    when: (mods) => mods.shift,
                    label: `Delete permanently`,
                    execute: shiftExec
                },
                {
                    when: (mods) => mods.alt,
                    label: `Duplicate`,
                    execute: altExec
                }
            ]
        });

        const shiftMods: ModifierMask = { ...NO_MODIFIERS, shift: true };
        const altMods: ModifierMask = { ...NO_MODIFIERS, alt: true };

        const r1 = resolveAction(action, NO_MODIFIERS);
        expect(r1.label).toBe(`Move to bin`);
        expect(r1.execute).toBe(base);

        const r2 = resolveAction(action, shiftMods);
        expect(r2.label).toBe(`Delete permanently`);
        expect(r2.execute).toBe(shiftExec);

        const r3 = resolveAction(action, altMods);
        expect(r3.label).toBe(`Duplicate`);
        expect(r3.execute).toBe(altExec);
    });

    it(`first-match wins when multiple variants match`, () => {
        const firstExec = vi.fn();
        const secondExec = vi.fn();
        const action = makeAction(`multi`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            variants: [
                { when: (mods) => mods.shift, label: `first`, execute: firstExec },
                { when: (mods) => mods.shift, label: `second`, execute: secondExec }
            ]
        });
        const r = resolveAction(action, { ...NO_MODIFIERS, shift: true });
        expect(r.label).toBe(`first`);
        expect(r.execute).toBe(firstExec);
    });

    it(`variant without execute reuses the base handler`, () => {
        const base = vi.fn();
        const action = makeAction(`label-only-variant`, {
            getState: () => ({ visibility: ActionVisibility.Shown, label: `Plain` }),
            executeAction: base,
            variants: [
                {
                    when: (mods) => mods.shift,
                    label: `Hyped`
                    // no execute — display-only variant
                }
            ]
        });
        const r = resolveAction(action, { ...NO_MODIFIERS, shift: true });
        expect(r.label).toBe(`Hyped`);
        expect(r.execute).toBe(base);
    });

    it(`resolves children lazily from the handler.children function`, () => {
        const childExec = vi.fn();
        const child = makeAction(`child`, {
            getState: () => ({ visibility: ActionVisibility.Shown, label: `Child` }),
            executeAction: childExec
        });
        const childResolver = vi.fn((_mods: ModifierMask) => [child]);
        const parent = makeAction(`parent`, {
            getState: () => ({ visibility: ActionVisibility.Shown, label: `Parent` }),
            children: childResolver
        });
        const r = resolveAction(parent, NO_MODIFIERS);
        expect(childResolver).toHaveBeenCalledOnce();
        expect(r.children).toHaveLength(1);
        expect(r.children[0]!.id).toBe(`child`);
        expect(r.children[0]!.label).toBe(`Child`);
    });

    it(`actions with no registered handler resolve to Hidden`, () => {
        const action = new Action({ id: `orphan`, category: `test` });
        const r = resolveAction(action, NO_MODIFIERS);
        expect(r.visibility).toBe(ActionVisibility.Hidden);
        expect(r.execute).toBeUndefined();
    });
});

describe(`modifierMaskFromEvent`, () => {
    it(`reads shift / alt / ctrl / meta off an event`, () => {
        const event = {
            shiftKey: true,
            altKey: false,
            ctrlKey: true,
            metaKey: false
        } as unknown as MouseEvent;
        expect(modifierMaskFromEvent(event)).toEqual({
            shift: true,
            alt: false,
            ctrl: true,
            meta: false
        });
    });

    it(`treats missing / undefined input as no modifiers`, () => {
        expect(modifierMaskFromEvent(undefined)).toEqual(NO_MODIFIERS);
        expect(modifierMaskFromEvent(null)).toEqual(NO_MODIFIERS);
    });
});

describe(`ActionManager.dispatchAction`, () => {
    it(`routes to the base handler with no event`, () => {
        const base = vi.fn();
        const action = makeAction(`d1`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: base
        });
        const manager = new ActionManager({
            recentActionsStorageKey: `t`,
            maxRecentActions: 10
        });
        manager.defineAction(action);
        manager.dispatchAction(`d1`);
        expect(base).toHaveBeenCalledOnce();
    });

    it(`routes to the variant handler matching the event's modifier mask`, () => {
        const base = vi.fn();
        const shiftExec = vi.fn();
        const action = makeAction(`d2`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: base,
            variants: [{ when: (m) => m.shift, label: `boom`, execute: shiftExec }]
        });
        const manager = new ActionManager({
            recentActionsStorageKey: `t`,
            maxRecentActions: 10
        });
        manager.defineAction(action);

        const event = { shiftKey: true } as unknown as MouseEvent;
        manager.dispatchAction(`d2`, event);

        expect(shiftExec).toHaveBeenCalledOnce();
        // execute is invoked with (event, scopeElement, payload); the last
        // two default to undefined when not supplied at the dispatch call.
        expect(shiftExec).toHaveBeenCalledWith(event, undefined, undefined);
        expect(base).not.toHaveBeenCalled();
    });

    it(`forwards scopeElement through to the resolved executor`, () => {
        const exec = vi.fn();
        const action = makeAction(`d4`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: exec
        });
        const manager = new ActionManager({
            recentActionsStorageKey: `t`,
            maxRecentActions: 10
        });
        manager.defineAction(action);

        // Stub element stands in for the right-clicked row element that
        // GlobalContextMenu captured before opening the dropdown menu.
        const scopeElement = { dataset: { itemId: `row-7` } } as unknown as HTMLElement;
        const event = { button: 0 } as unknown as MouseEvent;
        manager.dispatchAction(`d5-not-a-thing`, event, scopeElement); // unknown id no-ops
        expect(exec).not.toHaveBeenCalled();

        manager.dispatchAction(`d4`, event, scopeElement);
        expect(exec).toHaveBeenCalledOnce();
        expect(exec).toHaveBeenCalledWith(event, scopeElement, undefined);
    });

    it(`ignores variants that don't match the event modifiers`, () => {
        const base = vi.fn();
        const shiftExec = vi.fn();
        const action = makeAction(`d3`, {
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: base,
            variants: [{ when: (m) => m.shift, label: `boom`, execute: shiftExec }]
        });
        const manager = new ActionManager({
            recentActionsStorageKey: `t`,
            maxRecentActions: 10
        });
        manager.defineAction(action);

        // The user opened the menu while holding Shift but released before
        // clicking. The click event reports shiftKey === false → base runs.
        const event = { shiftKey: false } as unknown as MouseEvent;
        manager.dispatchAction(`d3`, event);

        expect(base).toHaveBeenCalledOnce();
        expect(shiftExec).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Audit log + undo / redo + transactions
// ============================================================================

const inMemoryAuditSlot = (initial: AuditEntry[] = []): AuditLogSlot & { dump: () => unknown } => {
    let value: unknown = initial;
    return {
        get: () => value,
        set: (v) => {
            value = v;
        },
        dump: () => value
    };
};

const inMemoryHistoryConfigSlot = (
    initial?: Partial<ActionHistoryConfig>
): ActionHistoryConfigSlot => {
    let value: unknown = initial;
    return {
        get: () => value,
        set: (v) => {
            value = v;
        }
    };
};

const inMemorySession = (): UndoStackStorageAdapter & { entries: () => Map<string, string> } => {
    const data = new Map<string, string>();
    return {
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
            data.set(k, v);
        },
        removeItem: (k) => {
            data.delete(k);
        },
        entries: () => data
    };
};

const undoableAction = (
    id: string,
    invertSpy: ReturnType<typeof vi.fn> = vi.fn(),
    opts: Partial<UndoableAction> = {},
    handlerOpts: Partial<ActionHandler> = {}
): Action =>
    new Action({
        id,
        category: `undoable`,
        actionHandlers: new Map([
            [
                `default`,
                {
                    id: `default`,
                    getState: () => ({ visibility: ActionVisibility.Shown }),
                    executeAction: (_event, _scope, payload) => {
                        return {
                            id: opts.id ?? `${id}-entry`,
                            actionId: id,
                            forwardPayload: payload,
                            inversePayload: opts.inversePayload ?? { from: `prev` },
                            timestamp: Date.now(),
                            describe: opts.describe ?? { labelKey: `actions.${id}` },
                            transactionGroupId: opts.transactionGroupId
                        };
                    },
                    invertAction: invertSpy,
                    ...handlerOpts
                }
            ]
        ])
    });

interface TestRig {
    manager: ActionManager;
    auditSlot: ReturnType<typeof inMemoryAuditSlot>;
    historySlot: ActionHistoryConfigSlot;
    undoStack: UndoStackManager;
    session: ReturnType<typeof inMemorySession>;
    toastCalls: Array<{ severity: string; message: string }>;
}

const TEST_TOAST_STRINGS: ActionManagerToastStrings = {
    undoFailed: `failed: {error}`,
    undoNoHandler: `no handler`,
    undoDropped: `dropped after {n}`,
    auditPersistenceDisabled: `audit disabled`
};

const buildRig = (
    overrides: {
        auditInitial?: AuditEntry[];
        historyConfig?: Partial<ActionHistoryConfig>;
    } = {}
): TestRig => {
    const auditSlot = inMemoryAuditSlot(overrides.auditInitial);
    const historySlot = inMemoryHistoryConfigSlot(overrides.historyConfig);
    const session = inMemorySession();
    const undoStack = new UndoStackManager({ storagePrefix: `test`, storage: session });
    const toastCalls: Array<{ severity: string; message: string }> = [];
    const toast: ActionToastFn = (severity, message) => {
        toastCalls.push({ severity, message });
    };
    const manager = new ActionManager({
        recentActionsSlot: { get: () => undefined, set: () => undefined },
        maxRecentActions: 10,
        auditLogSlot: auditSlot,
        historyConfigSlot: historySlot,
        undoStackManager: undoStack,
        toast,
        toastStrings: () => TEST_TOAST_STRINGS
    });
    return { manager, auditSlot, historySlot, undoStack, session, toastCalls };
};

describe(`measurePayloadBytes`, () => {
    it(`returns 0 for undefined`, () => {
        expect(measurePayloadBytes(undefined)).toBe(0);
    });
    it(`counts UTF-8 bytes accurately for multi-byte characters`, () => {
        // 'ä' is 2 bytes in UTF-8 but 1 UTF-16 code unit.
        expect(measurePayloadBytes(`ä`)).toBe(new Blob([JSON.stringify(`ä`)]).size);
    });
    it(`returns +Infinity for unstringifiable payloads`, () => {
        const cyclic: { self?: unknown } = {};
        cyclic.self = cyclic;
        expect(measurePayloadBytes(cyclic)).toBe(Number.POSITIVE_INFINITY);
    });
});

describe(`formatActionLabel`, () => {
    it(`returns empty string when descriptor is undefined`, () => {
        expect(formatActionLabel(undefined, undefined)).toBe(``);
    });
    it(`returns the raw labelKey when translation is missing`, () => {
        expect(formatActionLabel({ labelKey: `actions.foo` }, undefined)).toBe(`actions.foo`);
    });
    it(`interpolates {name} placeholders`, () => {
        const t = { actions: { "actions.foo": `Hello {name}` } } as unknown as Parameters<
            typeof formatActionLabel
        >[1];
        expect(formatActionLabel({ labelKey: `actions.foo`, params: { name: `world` } }, t)).toBe(
            `Hello world`
        );
    });
    it(`leaves unknown placeholders intact`, () => {
        const t = { actions: { "actions.foo": `Hello {name}` } } as unknown as Parameters<
            typeof formatActionLabel
        >[1];
        expect(formatActionLabel({ labelKey: `actions.foo`, params: { other: `x` } }, t)).toBe(
            `Hello {name}`
        );
    });
});

describe(`ActionManager — audit log`, () => {
    it(`records an AuditEntry for every dispatch`, () => {
        const rig = buildRig();
        const action = undoableAction(`a.read`);
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.read`);
        const log = rig.manager.getAuditLog();
        expect(log).toHaveLength(1);
        expect(log[0]!.actionId).toBe(`a.read`);
        expect(log[0]!.undoable).toBe(true);
    });

    it(`captures the modifier mask from the triggering event`, () => {
        const rig = buildRig();
        const action = undoableAction(`a.mod`);
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.mod`, { ctrlKey: true, shiftKey: true } as MouseEvent);
        const log = rig.manager.getAuditLog();
        expect(log[0]!.modifiers).toEqual({
            shift: true,
            alt: false,
            ctrl: true,
            meta: false
        });
    });

    it(`persists entries through the audit slot`, () => {
        const rig = buildRig();
        const action = undoableAction(`a.persist`);
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.persist`);
        const persisted = rig.auditSlot.dump() as AuditEntry[];
        expect(persisted).toHaveLength(1);
        expect(persisted[0]!.actionId).toBe(`a.persist`);
    });

    it(`fires the onAuditEntry callback`, () => {
        const onAuditEntry = vi.fn();
        const auditSlot = inMemoryAuditSlot();
        const undoStack = new UndoStackManager({
            storagePrefix: `t`,
            storage: inMemorySession()
        });
        const manager = new ActionManager({
            recentActionsSlot: { get: () => undefined, set: () => undefined },
            maxRecentActions: 5,
            auditLogSlot: auditSlot,
            undoStackManager: undoStack,
            toast: () => undefined,
            toastStrings: () => TEST_TOAST_STRINGS,
            onAuditEntry
        });
        const action = undoableAction(`a.cb`);
        manager.defineAction(action);
        manager.dispatchAction(`a.cb`);
        expect(onAuditEntry).toHaveBeenCalledOnce();
        expect(onAuditEntry.mock.calls[0]?.[0].actionId).toBe(`a.cb`);
    });

    it(`continues if the onAuditEntry callback throws`, () => {
        const auditSlot = inMemoryAuditSlot();
        const undoStack = new UndoStackManager({
            storagePrefix: `t`,
            storage: inMemorySession()
        });
        const manager = new ActionManager({
            recentActionsSlot: { get: () => undefined, set: () => undefined },
            maxRecentActions: 5,
            auditLogSlot: auditSlot,
            undoStackManager: undoStack,
            toast: () => undefined,
            toastStrings: () => TEST_TOAST_STRINGS,
            onAuditEntry: () => {
                throw new Error(`callback boom`);
            }
        });
        const action = undoableAction(`a.cb-throw`);
        manager.defineAction(action);
        expect(() => manager.dispatchAction(`a.cb-throw`)).not.toThrow();
        expect(manager.getAuditLog()).toHaveLength(1);
    });

    it(`rotates the audit log when maxAuditEntries is exceeded and drops corresponding undo entries`, () => {
        const rig = buildRig({ historyConfig: { ...DEFAULT_ACTION_HISTORY_CONFIG, maxAuditEntries: 3 } });
        const action = undoableAction(`a.rotate`);
        rig.manager.defineAction(action);
        for (let i = 0; i < 5; i += 1) {
            rig.manager.dispatchAction(`a.rotate`);
        }
        // Audit log capped to 3 entries (oldest dropped).
        expect(rig.manager.getAuditLog()).toHaveLength(3);
        // The 2 dropped audit entries had matching undo entries; those are
        // dropped too so we don't leave dangling "undoable" references.
        expect(rig.manager.getUndoStack()).toHaveLength(3);
    });

    it(`exportAuditLog returns a deep clone`, () => {
        const rig = buildRig();
        const action = undoableAction(`a.export`);
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.export`);
        const exported = rig.manager.exportAuditLog();
        exported.length = 0;
        expect(rig.manager.getAuditLog()).toHaveLength(1);
    });

    it(`drops payload when handler sets excludeFromAuditPayload`, () => {
        const rig = buildRig();
        const action = undoableAction(
            `a.optout`,
            vi.fn(),
            { inversePayload: { from: `prev` } },
            { excludeFromAuditPayload: true }
        );
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.optout`, undefined, null, { secret: `tok` });
        const entry = rig.manager.getAuditLog()[0]!;
        expect(entry.payload).toBeUndefined();
        expect(entry.payloadDropped).toBe(`opt-out`);
        // undo entry still created — payload opt-out doesn't disable undo
        expect(rig.manager.getUndoStack()).toHaveLength(1);
    });

    it(`drops payload + skips undo when handler sets excludeFromUndoStack`, () => {
        const rig = buildRig();
        const action = undoableAction(
            `a.no-undo`,
            vi.fn(),
            {},
            { excludeFromUndoStack: true }
        );
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.no-undo`);
        expect(rig.manager.getAuditLog()).toHaveLength(1);
        expect(rig.manager.getAuditLog()[0]!.undoable).toBe(false);
        expect(rig.manager.getUndoStack()).toHaveLength(0);
    });

    it(`drops payload and skips undo for oversized payloads`, () => {
        const rig = buildRig();
        const action = new Action({
            id: `a.big`,
            category: `test`,
            actionHandlers: new Map([
                [
                    `default`,
                    {
                        id: `default`,
                        getState: () => ({ visibility: ActionVisibility.Shown }),
                        // Tiny per-handler budget so we can blow it without
                        // building a multi-KB payload in the test fixture.
                        payloadByteBudget: 4,
                        executeAction: (_e, _s, payload) => ({
                            id: `e`,
                            actionId: `a.big`,
                            forwardPayload: payload,
                            inversePayload: { undo: payload },
                            timestamp: Date.now(),
                            describe: { labelKey: `actions.a.big` }
                        }),
                        invertAction: vi.fn()
                    }
                ]
            ])
        });
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`a.big`, undefined, null, `this-is-way-too-long`);
        const entry = rig.manager.getAuditLog()[0]!;
        expect(entry.payloadDropped).toBe(`oversize`);
        expect(entry.undoable).toBe(false);
        expect(rig.manager.getUndoStack()).toHaveLength(0);
    });
});

describe(`ActionManager — undo / redo`, () => {
    it(`undo invokes invertAction with the captured inversePayload`, async () => {
        const rig = buildRig();
        const invert = vi.fn();
        const action = undoableAction(`u.basic`, invert, { inversePayload: { x: 1 } });
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`u.basic`);
        await rig.manager.undo();
        expect(invert).toHaveBeenCalledWith({ x: 1 });
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(rig.manager.getRedoStack()).toHaveLength(1);
    });

    it(`redo re-applies the forward handler with the original forwardPayload`, async () => {
        const rig = buildRig();
        const invert = vi.fn();
        // Watch executeAction's invocation count separately from the spy
        // baked into `undoableAction` (which always returns an UndoableAction).
        let forwardCalls = 0;
        const action = new Action({
            id: `u.redo`,
            category: `test`,
            actionHandlers: new Map([
                [
                    `default`,
                    {
                        id: `default`,
                        getState: () => ({ visibility: ActionVisibility.Shown }),
                        executeAction: (_e, _s, payload) => {
                            forwardCalls += 1;
                            return {
                                id: `redo-entry`,
                                actionId: `u.redo`,
                                forwardPayload: payload ?? { v: 1 },
                                inversePayload: { v: 0 },
                                timestamp: Date.now(),
                                describe: { labelKey: `actions.u.redo` }
                            };
                        },
                        invertAction: invert
                    }
                ]
            ])
        });
        rig.manager.defineAction(action);
        rig.manager.dispatchAction(`u.redo`, undefined, null, { v: 1 });
        await rig.manager.undo();
        await rig.manager.redo();
        expect(forwardCalls).toBe(2);
        expect(rig.manager.getUndoStack()).toHaveLength(1);
        expect(rig.manager.getRedoStack()).toHaveLength(0);
    });

    it(`clears the redo stack on any new undoable dispatch`, async () => {
        const rig = buildRig();
        rig.manager.defineAction(undoableAction(`u.a`, vi.fn()));
        rig.manager.defineAction(undoableAction(`u.b`, vi.fn()));
        rig.manager.dispatchAction(`u.a`);
        await rig.manager.undo();
        expect(rig.manager.getRedoStack()).toHaveLength(1);
        rig.manager.dispatchAction(`u.b`);
        expect(rig.manager.getRedoStack()).toHaveLength(0);
    });

    it(`drops the entry and toasts when no handler is registered for undo`, async () => {
        const rig = buildRig();
        rig.manager.defineAction(undoableAction(`u.missing`, vi.fn()));
        rig.manager.dispatchAction(`u.missing`);
        // Forge: pretend the handler was unregistered between dispatch and undo.
        const action = rig.manager.getAction(`u.missing`)!;
        action.actionHandlers.clear();
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(rig.toastCalls.find((toast) => toast.message === `no handler`)).toBeTruthy();
    });

    it(`keeps the entry on the stack when invert throws (under retry budget) and toasts`, async () => {
        const rig = buildRig({ historyConfig: { ...DEFAULT_ACTION_HISTORY_CONFIG, maxInvertRetries: 3 } });
        const invert = vi.fn(() => {
            throw new Error(`bang`);
        });
        rig.manager.defineAction(undoableAction(`u.throw`, invert));
        rig.manager.dispatchAction(`u.throw`);
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(1);
        expect(rig.toastCalls.some((t) => t.message.includes(`bang`))).toBe(true);
        // Retry counter persisted on the entry.
        expect(rig.manager.getUndoStack()[0]!.invertRetries).toBe(1);
    });

    it(`drops the entry after maxInvertRetries failed invert attempts`, async () => {
        const rig = buildRig({ historyConfig: { ...DEFAULT_ACTION_HISTORY_CONFIG, maxInvertRetries: 2 } });
        const invert = vi.fn(() => {
            throw new Error(`nope`);
        });
        rig.manager.defineAction(undoableAction(`u.exhaust`, invert));
        rig.manager.dispatchAction(`u.exhaust`);
        await rig.manager.undo();
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(rig.toastCalls.some((t) => t.message.includes(`dropped after 2`))).toBe(true);
    });

    it(`handles async invert resolves successfully`, async () => {
        const rig = buildRig();
        const invert = vi.fn(async () => undefined);
        rig.manager.defineAction(undoableAction(`u.async`, invert));
        rig.manager.dispatchAction(`u.async`);
        await rig.manager.undo();
        expect(invert).toHaveBeenCalledOnce();
        expect(rig.manager.getUndoStack()).toHaveLength(0);
    });

    it(`ignores spammed undo calls while an invert is in flight`, async () => {
        const rig = buildRig();
        let resolveInvert: (() => void) | null = null;
        const invert = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveInvert = resolve;
                })
        );
        rig.manager.defineAction(undoableAction(`u.slow`, invert));
        rig.manager.dispatchAction(`u.slow`);
        const first = rig.manager.undo();
        // Second call while first is in flight should bail out.
        await rig.manager.undo();
        expect(invert).toHaveBeenCalledOnce();
        expect(rig.manager.isInvertInFlight()).toBe(true);
        resolveInvert!();
        await first;
        expect(rig.manager.isInvertInFlight()).toBe(false);
    });
});

describe(`ActionManager — transactions`, () => {
    it(`groups dispatches inside a transaction so undo pops them as one`, async () => {
        const rig = buildRig();
        const invertA = vi.fn();
        const invertB = vi.fn();
        rig.manager.defineAction(undoableAction(`tx.a`, invertA));
        rig.manager.defineAction(undoableAction(`tx.b`, invertB));
        rig.manager.beginTransaction(`group-1`);
        rig.manager.dispatchAction(`tx.a`);
        rig.manager.dispatchAction(`tx.b`);
        rig.manager.endTransaction(`group-1`);
        expect(rig.manager.getUndoStack()).toHaveLength(2);
        await rig.manager.undo();
        // Both entries gone in a single undo.
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(invertA).toHaveBeenCalledOnce();
        expect(invertB).toHaveBeenCalledOnce();
        // Invert order: most recent first.
        const invertAOrder = invertA.mock.invocationCallOrder[0]!;
        const invertBOrder = invertB.mock.invocationCallOrder[0]!;
        expect(invertBOrder).toBeLessThan(invertAOrder);
    });

    it(`does not group across transactions of different keys`, async () => {
        const rig = buildRig();
        rig.manager.defineAction(undoableAction(`tx.x`, vi.fn()));
        rig.manager.defineAction(undoableAction(`tx.y`, vi.fn()));
        rig.manager.beginTransaction(`grp1`);
        rig.manager.dispatchAction(`tx.x`);
        rig.manager.endTransaction(`grp1`);
        rig.manager.beginTransaction(`grp2`);
        rig.manager.dispatchAction(`tx.y`);
        rig.manager.endTransaction(`grp2`);
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(1);
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(0);
    });
});

describe(`ActionManager — defensive load + forged entries`, () => {
    it(`drops malformed audit entries on load`, () => {
        const auditSlot = inMemoryAuditSlot([
            { id: `ok`, actionId: `x`, timestamp: 1, tabId: `t`, modifiers: NO_MODIFIERS, undoable: false, category: `c` },
            // Missing required fields:
            { actionId: 12 } as unknown as AuditEntry
        ]);
        const undoStack = new UndoStackManager({ storagePrefix: `def`, storage: inMemorySession() });
        const manager = new ActionManager({
            recentActionsSlot: { get: () => undefined, set: () => undefined },
            maxRecentActions: 5,
            auditLogSlot: auditSlot,
            undoStackManager: undoStack,
            toast: () => undefined,
            toastStrings: () => TEST_TOAST_STRINGS
        });
        expect(manager.getAuditLog()).toHaveLength(1);
        expect(manager.getAuditLog()[0]!.id).toBe(`ok`);
    });

    it(`drops undo entries for actions that are not registered`, async () => {
        const rig = buildRig();
        // Inject a forged undo entry into the stack — no matching action.
        rig.undoStack.replace([
            {
                id: `forged-1`,
                actionId: `mows.forged`,
                inversePayload: { evil: true },
                timestamp: Date.now(),
                describe: { labelKey: `actions.evil` }
            }
        ]);
        await rig.manager.undo();
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(rig.toastCalls.some((t) => t.message === `no handler`)).toBe(true);
    });
});

describe(`ActionManager — persisted redo across reload`, () => {
    it(`redo stack survives a fresh ActionManager pointed at the same sessionStorage`, async () => {
        // Two managers + UndoStackManagers share the same in-memory
        // session adapter; the second instance models a page reload.
        const session = inMemorySession();
        const auditValues: Record<string, unknown> = {};
        const auditSlot: AuditLogSlot = {
            get: () => auditValues.audit,
            set: (v) => {
                auditValues.audit = v;
            }
        };
        const buildOne = () => {
            const undo = new UndoStackManager({ storagePrefix: `reload`, storage: session });
            const manager = new ActionManager({
                recentActionsSlot: { get: () => undefined, set: () => undefined },
                maxRecentActions: 5,
                auditLogSlot: auditSlot,
                undoStackManager: undo,
                toast: () => undefined,
                toastStrings: () => TEST_TOAST_STRINGS
            });
            return { manager, undo };
        };

        const first = buildOne();
        const invertCallsFirst: unknown[] = [];
        first.manager.defineAction(
            undoableAction(`r.theme`, vi.fn((p) => invertCallsFirst.push(p)))
        );
        first.manager.dispatchAction(`r.theme`);
        await first.manager.undo();
        expect(first.manager.getRedoStack()).toHaveLength(1);

        // Simulated reload: new manager re-reads the redo stack from
        // sessionStorage. Re-register the action so the handler is
        // available for redo to find.
        const second = buildOne();
        const forwardCalls: unknown[] = [];
        second.manager.defineAction(
            new Action({
                id: `r.theme`,
                category: `t`,
                actionHandlers: new Map([
                    [
                        `h`,
                        {
                            id: `h`,
                            getState: () => ({ visibility: ActionVisibility.Shown }),
                            executeAction: (_e, _s, payload) => {
                                forwardCalls.push(payload);
                                return {
                                    id: ``,
                                    actionId: `r.theme`,
                                    inversePayload: { from: `prev` },
                                    timestamp: Date.now(),
                                    describe: { labelKey: `actions.r.theme` }
                                };
                            },
                            invertAction: vi.fn()
                        }
                    ]
                ])
            })
        );
        expect(second.manager.getRedoStack()).toHaveLength(1);
        await second.manager.redo();
        expect(forwardCalls).toHaveLength(1);
        expect(second.manager.getRedoStack()).toHaveLength(0);
        expect(second.manager.getUndoStack()).toHaveLength(1);
    });
});

describe(`ActionManager — clearHistory + subscribe`, () => {
    it(`clearHistory empties both stacks and the audit log + notifies subscribers`, () => {
        const rig = buildRig();
        rig.manager.defineAction(undoableAction(`c.a`, vi.fn()));
        rig.manager.dispatchAction(`c.a`);
        const listener = vi.fn();
        rig.manager.subscribe(listener);
        rig.manager.clearHistory();
        expect(rig.manager.getAuditLog()).toHaveLength(0);
        expect(rig.manager.getUndoStack()).toHaveLength(0);
        expect(listener).toHaveBeenCalledOnce();
    });
});

// ============================================================================
// UndoStackManager — sessionStorage fallback
// ============================================================================

describe(`UndoStackManager`, () => {
    it(`persists to sessionStorage and reads back`, () => {
        const session = inMemorySession();
        const manager = new UndoStackManager({ storagePrefix: `sm`, storage: session });
        const entry: UndoableAction = {
            id: `e1`,
            actionId: `x`,
            inversePayload: {},
            timestamp: 1,
            describe: { labelKey: `k` }
        };
        manager.replace([entry]);
        expect(manager.getStack()).toEqual([entry]);
        expect(session.entries().has(`sm_undoStack`)).toBe(true);
    });

    it(`falls back to in-memory + warns once when setItem throws`, () => {
        const failing: UndoStackStorageAdapter = {
            getItem: () => null,
            setItem: () => {
                throw new Error(`QuotaExceededError`);
            },
            removeItem: () => undefined
        };
        const manager = new UndoStackManager({ storagePrefix: `fail`, storage: failing });
        const entry: UndoableAction = {
            id: `f1`,
            actionId: `y`,
            inversePayload: {},
            timestamp: 1,
            describe: { labelKey: `k` }
        };
        manager.replace([entry]);
        expect(manager.isUsingMemoryFallback()).toBe(true);
        expect(manager.getStack()).toEqual([entry]);
    });

    it(`drops malformed entries on read`, () => {
        const session = inMemorySession();
        session.setItem(
            `bad_undoStack`,
            JSON.stringify([{ actionId: `ok`, id: `1`, inversePayload: {} }, { broken: true }])
        );
        const manager = new UndoStackManager({ storagePrefix: `bad`, storage: session });
        const stack = manager.getStack();
        expect(stack).toHaveLength(1);
        expect(stack[0]!.id).toBe(`1`);
    });
});

// ============================================================================
// HotkeyManager wires the keydown event through to ActionManager
// ============================================================================

describe(`HotkeyManager → ActionManager event passthrough`, () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
    });

    it(`dispatchAction receives the original KeyboardEvent with its modifier mask`, async () => {
        const { HotkeyManager } = await import(`./HotkeyManager`);
        const rig = buildRig();
        const action = undoableAction(`hk.undo`, vi.fn());
        rig.manager.defineAction(action);
        const dispatchSpy = vi.spyOn(rig.manager, `dispatchAction`);
        new HotkeyManager(rig.manager, {
            configStorageKey: `hk-passthrough`,
            defaultHotkeys: { "hk.undo": { keyCombinations: [`mod+z`] } }
        });
        // Simulate keydown(Ctrl+Z) on a non-Mac platform.
        const event = new KeyboardEvent(`keydown`, {
            key: `z`,
            ctrlKey: true,
            bubbles: true
        });
        document.dispatchEvent(event);
        expect(dispatchSpy).toHaveBeenCalledWith(`hk.undo`, event);
    });
});
