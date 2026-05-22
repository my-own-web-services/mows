import "@testing-library/jest-dom/vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    ResourceListHandlers
} from "./ResourceListTypes";
import { SortDirection } from "./ResourceListTypes";

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
}

const renderList = (
    getResourcesList: (req: ListResourceRequestBody) => Promise<ListResourceResponseBody<Item>>,
    options: RenderOptions = {}
) => {
    const handler = new ColumnListRowHandler<Item>({
        columns,
        rowAttributes: options.rowAttributes,
        hideSelectionCheckboxColumn: options.hideSelectionCheckboxColumn
    });
    return render(
        <MowsContext.Provider value={buildContext()}>
            <div style={{ width: 800, height: 600 }}>
                <ResourceList<Item>
                    listInstanceId={`test-list`}
                    resourceType={`item`}
                    rowHandlers={[handler]}
                    initialRowHandler={handler.id}
                    getResourcesList={getResourcesList}
                    handlers={options.handlers}
                />
            </div>
        </MowsContext.Provider>
    );
};

describe(`ResourceList`, () => {
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
