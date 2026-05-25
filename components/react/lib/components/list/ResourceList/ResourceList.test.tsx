import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endDrag } from "./dragBus";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";

// react-virtualized-auto-sizer measures its parent at runtime; jsdom returns
// zero, so we mock it to feed a fixed width/height into FixedSizeList.
vi.mock(`react-virtualized-auto-sizer`, () => ({
    default: ({ children }: { children: (size: { width: number; height: number }) => React.ReactNode }) =>
        children({ width: 800, height: 600 })
}));

import ResourceList from "./ResourceList";
import ColumnListRowHandler, { type Column } from "./rowHandlers/Column";
import type {
    BaseResource,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ListRowHandler,
    ResourceListHandlers,
    RowComponentProps
} from "./ResourceListTypes";
import { RowRendererDirection, SortDirection } from "./ResourceListTypes";

interface Item extends BaseResource {
    readonly id: string;
    readonly name: string;
}

const ITEMS: Item[] = [
    { id: `1`, name: `Alpha` },
    { id: `2`, name: `Beta` },
    { id: `3`, name: `Gamma` }
];

const columns: Column<Item>[] = [
    {
        field: `name`,
        label: `Name`,
        direction: SortDirection.Ascending,
        widthPercent: 100,
        minWidthPixels: 80,
        enabled: true,
        render: (item) => <span data-testid={`item-${item.id}`}>{item.name}</span>
    }
];

const buildContext = (): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
    return {

        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEn,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager: am,
        hotkeyManager: hm,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined
    } as unknown as MowsContextType;
};

interface RenderOptions {
    readonly handlers?: ResourceListHandlers<Item>;
    readonly rowAttributes?: (item: Item) => Record<string, string>;
    readonly hideSelectionCheckboxColumn?: boolean;
    readonly reorderable?: boolean;
}

interface RenderResult {
    readonly container: HTMLElement;
    readonly listRef: React.RefObject<ResourceList<Item> | null>;
}

const renderList = (
    getResourcesList: (req: ListResourceRequestBody) => Promise<ListResourceResponseBody<Item>>,
    options: RenderOptions = {}
): RenderResult => {
    const handler = new ColumnListRowHandler<Item>({
        columns,
        rowAttributes: options.rowAttributes,
        hideSelectionCheckboxColumn: options.hideSelectionCheckboxColumn
    });
    const listRef = React.createRef<ResourceList<Item>>();
    const { container } = render(
        <MowsContext.Provider value={buildContext()}>
            <div style={{ width: 800, height: 600 }}>
                <ResourceList<Item>
                    ref={listRef}
                    listInstanceId={`test-list`}
                    resourceType={`item`}
                    rowHandlers={[handler]}
                    initialRowHandler={handler.id}
                    getResourcesList={getResourcesList}
                    handlers={options.handlers}
                    reorderable={options.reorderable}
                />
            </div>
        </MowsContext.Provider>
    );
    return { container, listRef };
};

interface MultiListConfig {
    readonly id: string;
    readonly items: Item[];
    readonly reorderAcceptsFrom?: string[];
    readonly handlers?: ResourceListHandlers<Item>;
}

interface MultiListResult {
    readonly container: HTMLElement;
    readonly refs: Record<string, React.RefObject<ResourceList<Item> | null>>;
}

// Renders multiple ResourceLists side-by-side in a single tree so
// cross-list drag-and-drop tests can act against them via real
// drag events.
const renderMultiList = (configs: MultiListConfig[]): MultiListResult => {
    const refs: Record<string, React.RefObject<ResourceList<Item> | null>> = {};
    for (const cfg of configs) {
        refs[cfg.id] = React.createRef<ResourceList<Item>>();
    }
    const { container } = render(
        <MowsContext.Provider value={buildContext()}>
            <div style={{ width: 1200, height: 600, display: `flex`, gap: 8 }}>
                {configs.map((cfg) => {
                    const handler = new ColumnListRowHandler<Item>({
                        columns,
                        hideSelectionCheckboxColumn: true
                    });
                    return (
                        <div key={cfg.id} style={{ flex: 1, height: 600 }}>
                            <ResourceList<Item>
                                ref={refs[cfg.id]}
                                listInstanceId={cfg.id}
                                resourceType={`item`}
                                rowHandlers={[handler]}
                                initialRowHandler={handler.id}
                                getResourcesList={async () => ({
                                    items: cfg.items,
                                    totalCount: cfg.items.length
                                })}
                                reorderable
                                reorderAcceptsFrom={cfg.reorderAcceptsFrom}
                                displayListHeader={false}
                                handlers={cfg.handlers}
                            />
                        </div>
                    );
                })}
            </div>
        </MowsContext.Provider>
    );
    return { container, refs };
};

const preselect = (listRef: React.RefObject<ResourceList<Item> | null>, indices: number[]) => {
    const sel: (true | undefined)[] = [];
    indices.forEach((i) => {
        sel[i] = true;
    });
    act(() => {
        listRef.current!.setState({ selectedItems: sel, lastSelectedItemIndex: indices[indices.length - 1] });
    });
};

// jsdom doesn't implement DataTransfer; a tiny shim lets us round-trip
// our reorder payload through the drag handlers.
class FakeDataTransfer {
    private store = new Map<string, string>();
    effectAllowed: string = `none`;
    dropEffect: string = `none`;

    setData = (type: string, value: string) => {
        this.store.set(type, value);
    };
    getData = (type: string) => this.store.get(type) ?? ``;
    get types() {
        return Array.from(this.store.keys());
    }
}

// fireEvent.dragOver loses `clientY` in jsdom (the DragEvent ctor
// quietly drops MouseEvent init fields), so we build the event by
// hand and stamp `clientY` + `dataTransfer` via defineProperty.
const fireDrag = (
    type: `dragstart` | `dragover` | `drop` | `dragend` | `dragleave` | `dragenter`,
    node: HTMLElement,
    dt: FakeDataTransfer,
    clientY?: number
) => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, `dataTransfer`, { value: dt, configurable: true });
    if (clientY !== undefined) {
        Object.defineProperty(ev, `clientY`, { value: clientY, configurable: true });
    }
    act(() => {
        node.dispatchEvent(ev);
    });
    return ev;
};

describe(`ResourceList`, () => {
    afterEach(() => {
        // The drag bus is a module-level singleton; if a test forgets
        // to fire dragend the leftover session can leak into the next
        // test and cause spurious drop handling.
        endDrag();
    });

    it(`calls getResourcesList on mount`, async () => {
        const fetcher = vi.fn(async (_req: ListResourceRequestBody) => ({
            totalCount: ITEMS.length,
            items: ITEMS
        }));
        renderList(fetcher);
        await waitFor(() => expect(fetcher).toHaveBeenCalled());
    });

    it(`first fetch passes fromIndex=0 + a finite limit`, async () => {
        const fetcher = vi.fn(async () => ({
            totalCount: 42,
            items: ITEMS
        }));
        renderList(fetcher);
        await waitFor(() => expect(fetcher).toHaveBeenCalled());
        const arg = fetcher.mock.calls[0]![0];
        expect(arg.fromIndex).toBe(0);
        expect(typeof arg.limit).toBe(`number`);
        expect(arg.limit).toBeGreaterThan(0);
    });

    it(`forwards a sortBy + sortDirection in the request body`, async () => {
        const fetcher = vi.fn(async () => ({
            totalCount: ITEMS.length,
            items: ITEMS
        }));
        renderList(fetcher);
        await waitFor(() => expect(fetcher).toHaveBeenCalled());
        const arg = fetcher.mock.calls[0]![0];
        expect(arg.sortBy).toBeDefined();
        expect(arg.sortDirection).toBeDefined();
    });

    it(`fires onItemRightClick when the row's outer area is right-clicked`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onItemRightClick = vi.fn();
        const { container } = renderList(fetcher, {
            handlers: { onItemRightClick },
            hideSelectionCheckboxColumn: true
        });
        const row = await waitFor(() => {
            const node = container.querySelector(`.ColumnListRowRenderer`);
            if (!node) throw new Error(`row not yet rendered`);
            return node as HTMLElement;
        });
        // Fire contextmenu on the row container itself (not on the cell text).
        // The bug was that right-clicks landing on the row gutter / row
        // padding never reached the handler — this assertion is what
        // would have caught it.
        fireEvent.contextMenu(row);
        expect(onItemRightClick).toHaveBeenCalledTimes(1);
        expect(onItemRightClick.mock.calls[0]![0]).toEqual(ITEMS[0]);
    });

    it(`fires onItemRightClick from a deeply nested element inside the row`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onItemRightClick = vi.fn();
        const { container } = renderList(fetcher, {
            handlers: { onItemRightClick },
            hideSelectionCheckboxColumn: true
        });
        const text = await waitFor(() => {
            const node = container.querySelector(`[data-testid="item-2"]`);
            if (!node) throw new Error(`cell text not yet rendered`);
            return node as HTMLElement;
        });
        fireEvent.contextMenu(text);
        expect(onItemRightClick).toHaveBeenCalledTimes(1);
        expect(onItemRightClick.mock.calls[0]![0]).toEqual(ITEMS[1]);
    });

    it(`renders the vertical layout with overflowY: scroll and overflowX: hidden`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher);
        // The first <div> inside the OuterResourceList that carries an
        // inline `overflowY` style is react-window's outer wrapper.
        await waitFor(() => {
            const node = container.querySelector(`.OuterResourceList`);
            if (!node?.firstChild) throw new Error(`list outer not yet rendered`);
        });
        const outer = container.querySelector(`.OuterResourceList`)!;
        const reactWindowOuter = outer.querySelector(`[style*="overflow"]`) as HTMLElement;
        expect(reactWindowOuter.style.overflowY).toBe(`scroll`);
        expect(reactWindowOuter.style.overflowX).toBe(`hidden`);
    });

    it(`renders a horizontal-layout row handler with overflowX: scroll and overflowY: hidden`, async () => {
        // Custom horizontal row handler — just enough surface area to
        // drive ResourceList's render path. The whole point of this test
        // is to guard the inline-style branch on the outer FixedSizeList,
        // so we don't need a fancy renderer.
        class HorizontalRowHandler implements ListRowHandler<Item> {
            id = `Horiz`;
            name = `Horiz`;
            icon = <span />;
            direction = RowRendererDirection.Horizontal;
            resourceList: never = undefined as never;
            getMinimumBatchSize = () => 10;
            getLoadMoreItemsThreshold = () => 5;
            getRowHeight = () => 120;
            getRowCount = (n: number) => n;
            getItemKey = (_items: (Item | undefined)[], i: number) => i;
            isItemLoaded = (items: (Item | undefined)[], i: number) => items[i] !== undefined;
            getStartIndexAndLimit = (startIndex: number, limit: number) => ({ startIndex, limit });
            rowRenderer = (rowProps: RowComponentProps<Item>) => (
                <div style={rowProps.style}>{rowProps.data?.items[rowProps.index]?.name}</div>
            );
            getSelectedItemsAfterKeypress = () => undefined;
        }
        const handler = new HorizontalRowHandler();
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = render(
            <MowsContext.Provider value={buildContext()}>
                <div style={{ width: 800, height: 200 }}>
                    <ResourceList<Item>
                        listInstanceId={`horiz-list`}
                        resourceType={`item`}
                        rowHandlers={[handler]}
                        initialRowHandler={handler.id}
                        getResourcesList={fetcher}
                    />
                </div>
            </MowsContext.Provider>
        );
        await waitFor(() => {
            const node = container.querySelector(`.OuterResourceList`);
            if (!node?.firstChild) throw new Error(`list outer not yet rendered`);
        });
        const outer = container.querySelector(`.OuterResourceList`)!;
        const reactWindowOuter = outer.querySelector(`[style*="overflow"]`) as HTMLElement;
        expect(reactWindowOuter.style.overflowX).toBe(`scroll`);
        // The screenshot bug: a horizontal strip must NOT have a
        // vertical scrollbar — overflowY must be hidden.
        expect(reactWindowOuter.style.overflowY).toBe(`hidden`);
    });

    it(`makes every row draggable when reorderable is set`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        rows.slice(0, ITEMS.length).forEach((row) => {
            expect(row.getAttribute(`draggable`)).toBe(`true`);
        });
        // The dedicated grip handle was retired — the whole row is the
        // drag surface now. Catch a regression that re-introduces it.
        expect(container.querySelectorAll(`.ResourceListReorderHandle`).length).toBe(0);
    });

    it(`leaves rows non-draggable when reorderable is not set`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        rows.slice(0, ITEMS.length).forEach((row) => {
            expect(row.getAttribute(`draggable`)).toBe(`false`);
        });
    });

    it(`fires onReorder when a row is dropped onto another row`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + rect.height - 2);
        fireDrag(`drop`, targetRow, dt, rect.top + rect.height - 2);

        expect(onReorder).toHaveBeenCalledTimes(1);
        // from index 0, dropped on the lower half of row 2 → insert
        // before row 3, then shift back by one for the removed source
        // → toIndex = 2. Single-row drag still surfaces a 1-element
        // fromIndices array.
        expect(onReorder.mock.calls[0]).toEqual([[0], 2]);
    });

    it(`drags every selected row when the dragged row is part of the selection`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container, listRef } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        // Select Alpha + Beta, drag from Alpha (part of selection), drop after Gamma.
        preselect(listRef, [0, 1]);

        const sourceRow = rows[0]!; // Alpha (selected)
        const targetRow = rows[2]!; // Gamma
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        // The payload must carry BOTH selected indices, not just the
        // index of the dragged row.
        expect(dt.getData(`application/x-mows-resourcelist-reorder`).endsWith(`:0,1`)).toBe(true);

        fireDrag(`dragover`, targetRow, dt, rect.top + rect.height - 2);
        fireDrag(`drop`, targetRow, dt, rect.top + rect.height - 2);

        // Both rows moved past Gamma → [Gamma, Alpha, Beta].
        const readNames = () =>
            Array.from(container.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer span[data-testid]`)).map(
                (el) => el.textContent
            );
        await waitFor(() => expect(readNames()).toEqual([`Gamma`, `Alpha`, `Beta`]));
        // Consumer learns the original indices + the post-removal landing index.
        expect(onReorder).toHaveBeenCalledTimes(1);
        expect(onReorder.mock.calls[0]).toEqual([[0, 1], 1]);
    });

    it(`carries only the dragged row when that row is NOT in the selection`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container, listRef } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        preselect(listRef, [0, 1]); // Alpha + Beta selected
        const sourceRow = rows[2]!; // Gamma (NOT selected) is the drag source
        const targetRow = rows[0]!; // drop before Alpha
        const rect = { top: 0, height: 20, bottom: 20, left: 0, right: 800, width: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        // Single index in payload — the selection is left untouched.
        expect(dt.getData(`application/x-mows-resourcelist-reorder`).endsWith(`:2`)).toBe(true);
        fireDrag(`dragover`, targetRow, dt, 2);
        fireDrag(`drop`, targetRow, dt, 2);

        const readNames = () =>
            Array.from(container.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer span[data-testid]`)).map(
                (el) => el.textContent
            );
        await waitFor(() => expect(readNames()).toEqual([`Gamma`, `Alpha`, `Beta`]));
        expect(onReorder).toHaveBeenCalledTimes(1);
        expect(onReorder.mock.calls[0]).toEqual([[2], 0]);
    });

    it(`preserves the selection across a multi-row move`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container, listRef } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        preselect(listRef, [0, 2]); // non-contiguous selection: Alpha + Gamma
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + rect.height - 2);
        fireDrag(`drop`, targetRow, dt, rect.top + rect.height - 2);

        // Result: [Beta, Alpha, Gamma]. Selection follows the moved
        // items to their new positions (1 and 2).
        const readNames = () =>
            Array.from(container.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer span[data-testid]`)).map(
                (el) => el.textContent
            );
        await waitFor(() => expect(readNames()).toEqual([`Beta`, `Alpha`, `Gamma`]));
        const selectedItems = listRef.current!.state.selectedItems;
        expect(selectedItems[1]).toBe(true);
        expect(selectedItems[2]).toBe(true);
        expect(selectedItems[0]).toBeUndefined();
    });

    it(`treats a contiguous selection dropped onto its own start as a no-op`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container, listRef } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        preselect(listRef, [0, 1]);
        const sourceRow = rows[0]!;
        const targetRow = rows[0]!;
        const rect = { top: 0, height: 20, bottom: 20, left: 0, right: 800, width: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        // Upper half of row 0 → insertBeforeIndex = 0; sorted source
        // starts at 0; adjustedInsertAt = 0 → no-op.
        fireDrag(`drop`, targetRow, dt, 2);
        expect(onReorder).not.toHaveBeenCalled();
    });

    it(`actually reorders rows in the DOM after a drop (not just calls the handler)`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });

        const readNames = () =>
            Array.from(container.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer span[data-testid]`)).map(
                (el) => el.textContent
            );
        expect(readNames()).toEqual([`Alpha`, `Beta`, `Gamma`]);

        const sourceRow = rows[0]!; // Alpha
        const targetRow = rows[2]!; // Gamma
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + rect.height - 2);
        fireDrag(`drop`, targetRow, dt, rect.top + rect.height - 2);

        // Alpha moved past Beta and Gamma → final order is [Beta, Gamma, Alpha].
        // The list owns its render order and must reflect this even though
        // the test doesn't supply an onReorder handler.
        await waitFor(() => {
            expect(readNames()).toEqual([`Beta`, `Gamma`, `Alpha`]);
        });
    });

    it(`renders exactly one list-level insertion line on dragover, never two adjacent ones`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + 2);
        const indicators = container.querySelectorAll(`.ResourceListReorderIndicator`);
        expect(indicators.length).toBe(1);
        // Indicator lives on the list, not inside any row.
        expect(targetRow.querySelectorAll(`.ResourceListReorderIndicator`).length).toBe(0);
    });

    it(`upper-half hover places the line at the boundary BEFORE the target row`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + 2);
        const indicator = container.querySelector<HTMLElement>(`.ResourceListReorderIndicator`);
        expect(indicator).not.toBeNull();
        // rowHeight = 24 (Column default), target index = 2, upper-half → insert before 2 → top = 2*24 = 48
        expect(indicator!.style.top).toBe(`48px`);
    });

    it(`lower-half hover places the line at the boundary AFTER the target row`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + rect.height - 2);
        const indicator = container.querySelector<HTMLElement>(`.ResourceListReorderIndicator`);
        expect(indicator).not.toBeNull();
        // Lower-half → insert before 3 → top = 3*24 = 72
        expect(indicator!.style.top).toBe(`72px`);
    });

    it(`clears the insertion line on dragend so it never lingers after an aborted drag`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, rect.top + 2);
        expect(container.querySelectorAll(`.ResourceListReorderIndicator`).length).toBe(1);
        fireDrag(`dragend`, sourceRow, dt);
        await waitFor(() => {
            expect(container.querySelectorAll(`.ResourceListReorderIndicator`).length).toBe(0);
        });
    });

    it(`does NOT fire onReorder when source equals target (no-op)`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const sourceRow = rows[0]!;
        const targetRow = rows[0]!;
        const rect = { top: 0, height: 20, bottom: 20, left: 0, right: 800, width: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, 2);
        fireDrag(`drop`, targetRow, dt, 2);
        expect(onReorder).not.toHaveBeenCalled();
    });

    it(`ignores drag payloads from a different list instance`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const targetRow = rows[2]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 800, width: 800, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;
        const dt = new FakeDataTransfer();
        // Payload from a different list-instance scope must be rejected.
        dt.setData(`application/x-mows-resourcelist-reorder`, `some-other-list:item:0`);
        fireDrag(`dragover`, targetRow, dt, rect.top + 2);
        fireDrag(`drop`, targetRow, dt, rect.top + 2);
        expect(onReorder).not.toHaveBeenCalled();
    });

    it(`accepts a drop from a list whose id is in reorderAcceptsFrom`, async () => {
        const ITEMS_A: Item[] = [{ id: `a1`, name: `A1` }, { id: `a2`, name: `A2` }];
        const ITEMS_B: Item[] = [{ id: `b1`, name: `B1` }, { id: `b2`, name: `B2` }];
        const onItemsAccepted = vi.fn();
        const onItemsMovedOut = vi.fn();
        const { container, refs } = renderMultiList([
            {
                id: `list-A`,
                items: ITEMS_A,
                reorderAcceptsFrom: [`list-B`],
                handlers: { onItemsAccepted }
            },
            {
                id: `list-B`,
                items: ITEMS_B,
                reorderAcceptsFrom: [`list-A`],
                handlers: { onItemsMovedOut }
            }
        ]);
        await waitFor(() => {
            const rows = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (rows.length < ITEMS_A.length + ITEMS_B.length) {
                throw new Error(`rows not yet rendered`);
            }
        });
        const rowsA = refs[`list-A`]!.current!.listOuterRef.current!.querySelectorAll<HTMLElement>(
            `.ColumnListRowRenderer`
        );
        const rowsB = refs[`list-B`]!.current!.listOuterRef.current!.querySelectorAll<HTMLElement>(
            `.ColumnListRowRenderer`
        );
        // Drag B's first row into A, drop on the upper half of A's
        // first row → insertBeforeIndex = 0.
        const sourceRow = rowsB[0]!;
        const targetRow = rowsA[0]!;
        const rect = { top: 0, height: 20, bottom: 20, left: 0, right: 400, width: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRow, dt, 2);
        fireDrag(`drop`, targetRow, dt, 2);
        fireDrag(`dragend`, sourceRow, dt);

        // Target accepted the item and prepended it.
        await waitFor(() => {
            expect(refs[`list-A`]!.current!.state.resources.map((r) => r?.id)).toEqual([
                `b1`,
                `a1`,
                `a2`
            ]);
        });
        // Source has the item spliced out.
        expect(refs[`list-B`]!.current!.state.resources.map((r) => r?.id)).toEqual([`b2`]);
        // Consumer callbacks fired with the right metadata.
        expect(onItemsAccepted).toHaveBeenCalledTimes(1);
        expect(onItemsAccepted.mock.calls[0]![0]).toEqual([ITEMS_B[0]]);
        expect(onItemsAccepted.mock.calls[0]![1]).toBe(0);
        expect(onItemsAccepted.mock.calls[0]![2]).toBe(`list-B`);
        expect(onItemsMovedOut).toHaveBeenCalledTimes(1);
        expect(onItemsMovedOut.mock.calls[0]).toEqual([[0], `list-A`]);
    });

    it(`rejects a drop from a list whose id is NOT in reorderAcceptsFrom`, async () => {
        const ITEMS_A: Item[] = [{ id: `a1`, name: `A1` }];
        const ITEMS_C: Item[] = [{ id: `c1`, name: `C1` }, { id: `c2`, name: `C2` }];
        const onItemsAccepted = vi.fn();
        const onItemsMovedOut = vi.fn();
        const { container, refs } = renderMultiList([
            { id: `list-A`, items: ITEMS_A, handlers: { onItemsMovedOut } },
            // C rejects everything external: no reorderAcceptsFrom.
            { id: `list-C`, items: ITEMS_C, handlers: { onItemsAccepted } }
        ]);
        await waitFor(() => {
            const rows = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (rows.length < ITEMS_A.length + ITEMS_C.length) {
                throw new Error(`rows not yet rendered`);
            }
        });
        const rowsA = refs[`list-A`]!.current!.listOuterRef.current!.querySelectorAll<HTMLElement>(
            `.ColumnListRowRenderer`
        );
        const rowsC = refs[`list-C`]!.current!.listOuterRef.current!.querySelectorAll<HTMLElement>(
            `.ColumnListRowRenderer`
        );
        const sourceRow = rowsA[0]!;
        const targetRow = rowsC[0]!;
        const rect = { top: 0, height: 20, bottom: 20, left: 0, right: 400, width: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        targetRow.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        const overEv = fireDrag(`dragover`, targetRow, dt, 2);
        // dragover must NOT be prevented for rejecting targets — the
        // browser then shows a no-drop cursor and `drop` does not fire.
        expect(overEv.defaultPrevented).toBe(false);
        fireDrag(`drop`, targetRow, dt, 2);
        fireDrag(`dragend`, sourceRow, dt);

        // Nothing moved.
        expect(refs[`list-A`]!.current!.state.resources.map((r) => r?.id)).toEqual([`a1`]);
        expect(refs[`list-C`]!.current!.state.resources.map((r) => r?.id)).toEqual([`c1`, `c2`]);
        expect(onItemsAccepted).not.toHaveBeenCalled();
        expect(onItemsMovedOut).not.toHaveBeenCalled();
    });

    it(`paints accept vs reject overlays on each list during an in-flight foreign drag`, async () => {
        const ITEMS_A: Item[] = [{ id: `a1`, name: `A1` }];
        const ITEMS_B: Item[] = [{ id: `b1`, name: `B1` }];
        const ITEMS_C: Item[] = [{ id: `c1`, name: `C1` }];
        const { container, refs } = renderMultiList([
            { id: `list-A`, items: ITEMS_A, reorderAcceptsFrom: [`list-B`] },
            { id: `list-B`, items: ITEMS_B, reorderAcceptsFrom: [`list-A`] },
            { id: `list-C`, items: ITEMS_C }
        ]);
        await waitFor(() => {
            const rows = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (rows.length < 3) throw new Error(`rows not yet rendered`);
        });
        const rowsA = refs[`list-A`]!.current!.listOuterRef.current!.querySelectorAll<HTMLElement>(
            `.ColumnListRowRenderer`
        );
        const sourceRow = rowsA[0]!;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);

        const overlayB = container
            .querySelector(`[data-list-instance-id="list-B"]`)
            ?.querySelector(`.ResourceListCrossListOverlay`);
        const overlayC = container
            .querySelector(`[data-list-instance-id="list-C"]`)
            ?.querySelector(`.ResourceListCrossListOverlay`);
        // Source list never paints itself.
        const overlayA = container
            .querySelector(`[data-list-instance-id="list-A"]`)
            ?.querySelector(`.ResourceListCrossListOverlay`);

        expect(overlayA).toBeNull();
        expect(overlayB?.getAttribute(`data-accepts-drag`)).toBe(`true`);
        expect(overlayC?.getAttribute(`data-accepts-drag`)).toBe(`false`);

        fireDrag(`dragend`, sourceRow, dt);
        // Overlays clear after dragend.
        await waitFor(() => {
            expect(container.querySelectorAll(`.ResourceListCrossListOverlay`).length).toBe(0);
        });
    });

    it(`clears the source list's insertion line when the pointer enters another list`, async () => {
        // Bug: dragging an item out of list A and over list B's rows
        // left A's insertion line painted on A — A's rows never got
        // another dragover/dragleave because the pointer was no longer
        // over them. The fix is a dragleave on the list wrapper that
        // clears the indicator whenever the pointer truly exits.
        const ITEMS_A: Item[] = [{ id: `a1`, name: `A1` }, { id: `a2`, name: `A2` }];
        const ITEMS_B: Item[] = [{ id: `b1`, name: `B1` }, { id: `b2`, name: `B2` }];
        const { container, refs } = renderMultiList([
            { id: `list-A`, items: ITEMS_A, reorderAcceptsFrom: [`list-B`] },
            { id: `list-B`, items: ITEMS_B, reorderAcceptsFrom: [`list-A`] }
        ]);
        await waitFor(() => {
            const rows = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (rows.length < ITEMS_A.length + ITEMS_B.length) {
                throw new Error(`rows not yet rendered`);
            }
        });
        const wrapperA = container.querySelector<HTMLElement>(
            `[data-list-instance-id="list-A"]`
        )!;
        const wrapperB = container.querySelector<HTMLElement>(
            `[data-list-instance-id="list-B"]`
        )!;
        const rowsA = wrapperA.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer`);
        const rowsB = wrapperB.querySelectorAll<HTMLElement>(`.ColumnListRowRenderer`);
        const sourceRow = rowsA[0]!;
        const targetRowInA = rowsA[1]!;
        const targetRowInB = rowsB[0]!;
        const rect = { top: 100, height: 20, bottom: 120, left: 0, right: 400, width: 400, x: 0, y: 100, toJSON: () => ({}) } as DOMRect;
        targetRowInA.getBoundingClientRect = () => rect;
        targetRowInB.getBoundingClientRect = () => rect;

        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        fireDrag(`dragover`, targetRowInA, dt, rect.top + rect.height - 2);
        // List A now shows its insertion line.
        expect(
            wrapperA.querySelectorAll(`.ResourceListReorderIndicator`).length
        ).toBe(1);

        // Pointer leaves list A and moves into list B — dragleave on A
        // fires with relatedTarget = an element inside B.
        // Custom event so we can stamp `relatedTarget` (jsdom drops it
        // off the standard DragEvent ctor the same way it drops
        // clientY).
        act(() => {
            const leaveA = new Event(`dragleave`, { bubbles: true, cancelable: true });
            Object.defineProperty(leaveA, `dataTransfer`, { value: dt, configurable: true });
            Object.defineProperty(leaveA, `relatedTarget`, {
                value: targetRowInB,
                configurable: true
            });
            sourceRow.dispatchEvent(leaveA);
        });

        // A's line is gone.
        expect(
            wrapperA.querySelectorAll(`.ResourceListReorderIndicator`).length
        ).toBe(0);

        fireDrag(`dragend`, sourceRow, dt);
    });

    it(`drops onto the empty tail area below the last row (appends at end)`, async () => {
        // Bug: releasing over the empty space below the last row never
        // fired a drop — only releases on rows worked. The fix is a
        // wrapper-level drop handler that uses totalItemCount as the
        // insertion boundary.
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const onReorder = vi.fn();
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            reorderable: true,
            handlers: { onReorder }
        });
        const rows = await waitFor(() => {
            const r = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (r.length < ITEMS.length) throw new Error(`rows not yet rendered`);
            return Array.from(r) as HTMLElement[];
        });
        const wrapper = container.querySelector<HTMLElement>(
            `[data-list-instance-id="test-list"]`
        )!;
        const sourceRow = rows[0]!; // Alpha
        const dt = new FakeDataTransfer();
        fireDrag(`dragstart`, sourceRow, dt);
        // Fire dragover + drop on the wrapper itself (not on a row).
        // e.target ends up as the wrapper, so isPointerInRow is false
        // and the wrapper handler does the work.
        fireDrag(`dragover`, wrapper, dt);
        fireDrag(`drop`, wrapper, dt);

        // Alpha appended to the end → [Beta, Gamma, Alpha].
        expect(onReorder).toHaveBeenCalledTimes(1);
        // sorted = [0], insertBeforeIndex = totalItemCount = 3,
        // adjustedInsertAt = 3 - 1 = 2.
        expect(onReorder.mock.calls[0]).toEqual([[0], 2]);
        const readNames = () =>
            Array.from(
                container.querySelectorAll<HTMLElement>(
                    `.ColumnListRowRenderer span[data-testid]`
                )
            ).map((el) => el.textContent);
        await waitFor(() => expect(readNames()).toEqual([`Beta`, `Gamma`, `Alpha`]));
    });

    it(`stamps rowAttributes onto each row's outer div`, async () => {
        const fetcher = async () => ({ totalCount: ITEMS.length, items: ITEMS });
        const { container } = renderList(fetcher, {
            hideSelectionCheckboxColumn: true,
            rowAttributes: (item) => ({
                "data-actionscope": `testScope`,
                "data-item-id": item.id
            })
        });
        await waitFor(() => {
            const rows = container.querySelectorAll(`.ColumnListRowRenderer`);
            if (rows.length < ITEMS.length) throw new Error(`rows not yet rendered`);
        });
        const rows = Array.from(container.querySelectorAll(`.ColumnListRowRenderer`)) as HTMLElement[];
        rows.slice(0, ITEMS.length).forEach((row, index) => {
            expect(row.getAttribute(`data-actionscope`)).toBe(`testScope`);
            expect(row.getAttribute(`data-item-id`)).toBe(ITEMS[index]!.id);
        });
    });
});
