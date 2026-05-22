import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import {
    Action,
    ActionManager,
    ActionVisibility,
    modifierMaskFromEvent,
    NO_MODIFIERS,
    resolveAction,
    type ActionHandler,
    type ModifierMask
} from "./ActionManager";

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
        // execute is invoked with (event, scopeElement); the second arg
        // defaults to undefined when not supplied at the dispatch call.
        expect(shiftExec).toHaveBeenCalledWith(event, undefined);
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
        expect(exec).toHaveBeenCalledWith(event, scopeElement);
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
