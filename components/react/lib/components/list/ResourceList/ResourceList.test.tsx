import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
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
    ListResourceResponseBody
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

const renderList = (
    getResourcesList: (req: ListResourceRequestBody) => Promise<ListResourceResponseBody<Item>>
) => {
    const handler = new ColumnListRowHandler<Item>({ columns });
    return render(
        <MowsContext.Provider value={buildContext()}>
            <div style={{ width: 800, height: 600 }}>
                <ResourceList<Item>
                    listInstanceId={`test-list`}
                    resourceType={`item`}
                    rowHandlers={[handler]}
                    initialRowHandler={handler.id}
                    getResourcesList={getResourcesList}
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
});
