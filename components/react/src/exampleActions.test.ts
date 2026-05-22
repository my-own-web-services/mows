import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import {
    ActionManager,
    resolveAction,
    NO_MODIFIERS
} from "../lib/lib/mowsContext/ActionManager";
import {
    EXAMPLE_REPO_LIST_ITEM_SCOPE,
    ExampleActionIds,
    exampleActions,
    registerRepoList
} from "./exampleActions";

// Spin up the same ActionManager / Action layout the example would, then
// drive `REPO_DELETE` directly to assert the targeting rules. The
// alternative (mounting the example + GlobalContextMenu + a virtualised
// ResourceList) buys little extra coverage and is far slower.
const buildManager = (): ActionManager => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    am.defineMultipleActions(exampleActions);
    return am;
};

// Build a stub DOM tree shaped like a real right-clicked row inside the
// shared-action lists. `scopeElement` is what GlobalContextMenu hands to
// `executeAction` after a contextmenu event lands on `inner`.
const buildScopedTarget = (listId: string, itemId: string): HTMLElement => {
    const list = document.createElement(`div`);
    list.setAttribute(`data-list-id`, listId);
    const row = document.createElement(`div`);
    row.setAttribute(`data-actionscope`, EXAMPLE_REPO_LIST_ITEM_SCOPE);
    row.setAttribute(`data-item-id`, itemId);
    const inner = document.createElement(`span`);
    list.appendChild(row);
    row.appendChild(inner);
    document.body.appendChild(list);
    return inner;
};

describe(`REPO_DELETE action`, () => {
    it(`deletes only the right-clicked row when no selection`, () => {
        const manager = buildManager();
        const deleteByIds = vi.fn();
        const unregister = registerRepoList(`list-A`, {
            deleteByIds,
            getSelectedIds: () => []
        });
        const target = buildScopedTarget(`list-A`, `row-1`);

        manager.dispatchAction(ExampleActionIds.REPO_DELETE, undefined, target);

        expect(deleteByIds).toHaveBeenCalledOnce();
        expect(deleteByIds).toHaveBeenCalledWith([`row-1`]);
        unregister();
    });

    it(`deletes only the right-clicked row when it is NOT part of the selection`, () => {
        const manager = buildManager();
        const deleteByIds = vi.fn();
        // User has rows 7 and 8 selected but right-clicked row 3.
        // OS-like behaviour: act on the right-clicked row only.
        const unregister = registerRepoList(`list-B`, {
            deleteByIds,
            getSelectedIds: () => [`row-7`, `row-8`]
        });
        const target = buildScopedTarget(`list-B`, `row-3`);

        manager.dispatchAction(ExampleActionIds.REPO_DELETE, undefined, target);

        expect(deleteByIds).toHaveBeenCalledWith([`row-3`]);
        unregister();
    });

    it(`deletes the whole selection when the right-clicked row is part of it`, () => {
        const manager = buildManager();
        const deleteByIds = vi.fn();
        const selected = [`row-2`, `row-5`, `row-9`];
        const unregister = registerRepoList(`list-C`, {
            deleteByIds,
            getSelectedIds: () => selected
        });
        // Right-click lands on row-5 — which IS in the current selection,
        // so Delete should remove every selected row at once.
        const target = buildScopedTarget(`list-C`, `row-5`);

        manager.dispatchAction(ExampleActionIds.REPO_DELETE, undefined, target);

        expect(deleteByIds).toHaveBeenCalledOnce();
        const arg = deleteByIds.mock.calls[0]![0] as ReadonlyArray<string>;
        expect([...arg].sort()).toEqual([...selected].sort());
        unregister();
    });

    it(`no-ops when the right-clicked row has no resolvable list registration`, () => {
        const manager = buildManager();
        const deleteByIds = vi.fn();
        const unregister = registerRepoList(`list-D`, {
            deleteByIds,
            getSelectedIds: () => []
        });
        // The right-clicked row's data-list-id points at a list that
        // isn't currently mounted — the handler must silently no-op,
        // not throw.
        const target = buildScopedTarget(`list-NOT-MOUNTED`, `row-1`);
        expect(() =>
            manager.dispatchAction(ExampleActionIds.REPO_DELETE, undefined, target)
        ).not.toThrow();
        expect(deleteByIds).not.toHaveBeenCalled();
        unregister();
    });

    it(`resolveAction surface still reports the visible RepoDelete entry`, () => {
        const manager = buildManager();
        const action = manager.getAction(ExampleActionIds.REPO_DELETE)!;
        // Just sanity-check that the action exists in the public surface
        // (so the shared-action example actually has something to dispatch).
        const resolved = resolveAction(action, NO_MODIFIERS);
        expect(resolved.execute).toBeTypeOf(`function`);
    });
});
