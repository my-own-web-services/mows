import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ConsoleManager, { type ConsoleType } from "./ConsoleManager";

const dummyType = (id: string, label: string): ConsoleType => ({
    id,
    label,
    render: () => <div data-testid={`body-${id}`}>{`body of ${label}`}</div>
});

const tabListOf = (container: HTMLElement): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[data-console-tab-list]`);
    if (!el) throw new Error(`tab list not found`);
    return el;
};

const groupCount = (container: HTMLElement): number =>
    container.querySelectorAll(`[data-console-group]`).length;

// jsdom-friendly DataTransfer stand-in for the HTML5 drag API.
const makeDataTransfer = () => {
    const data: Record<string, string> = {};
    return {
        data,
        effectAllowed: ``,
        dropEffect: ``,
        setData(type: string, value: string) {
            data[type] = value;
        },
        getData(type: string) {
            return data[type] ?? ``;
        },
        clearData() {
            for (const k of Object.keys(data)) delete data[k];
        }
    };
};

describe(`ConsoleManager`, () => {
    it(`renders one top-level group per seeded initial tab (VSCode model: + per terminal)`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        expect(groupCount(container)).toBe(2);
        const list = tabListOf(container);
        const rows = within(list).getAllByRole(`tab`);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent(`Terminal 1`);
        expect(rows[1]).toHaveTextContent(`Terminal 2`);
        // The first seeded terminal is the initial active one.
        expect(rows[0]).toHaveAttribute(`aria-selected`, `true`);
        expect(rows[1]).toHaveAttribute(`aria-selected`, `false`);
    });

    it(`+ opens a new top-level group (not a tab in an existing group)`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }]}
            />
        );
        expect(groupCount(container)).toBe(1);
        fireEvent.click(screen.getByRole(`button`, { name: `New Terminal` }));
        expect(groupCount(container)).toBe(2);
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        expect(rows).toHaveLength(2);
        // Newly opened group's terminal is active.
        expect(rows[1]).toHaveAttribute(`aria-selected`, `true`);
    });

    it(`per-row Split adds a sibling inside the same group (VSCode createTerminal with parentTerminal)`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }]}
            />
        );
        expect(groupCount(container)).toBe(1);
        const splitBtns = within(tabListOf(container)).getAllByRole(`button`, {
            name: /^Split Terminal /
        });
        expect(splitBtns).toHaveLength(1);
        act(() => fireEvent.click(splitBtns[0]));
        // Still one group — the new terminal is a sibling slot, not a new group.
        expect(groupCount(container)).toBe(1);
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        expect(rows).toHaveLength(2);
        // The new terminal becomes active.
        expect(rows[1]).toHaveAttribute(`aria-selected`, `true`);
    });

    it(`split siblings within a group get box-drawing prefixes (┌ … └) just like VSCode's renderElement`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }]}
            />
        );
        // Two splits → 3 siblings → ┌ ├ └ prefixes.
        const splitOne = within(tabListOf(container)).getByRole(`button`, {
            name: /^Split Terminal /
        });
        act(() => fireEvent.click(splitOne));
        const splitTwo = within(tabListOf(container)).getAllByRole(`button`, {
            name: /^Split Terminal /
        })[0];
        act(() => fireEvent.click(splitTwo));
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        expect(rows).toHaveLength(3);
        expect(rows[0].textContent).toContain(`┌`);
        expect(rows[1].textContent).toContain(`├`);
        expect(rows[2].textContent).toContain(`└`);
    });

    it(`single-terminal groups carry no prefix`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        for (const row of rows) {
            expect(row.textContent).not.toContain(`┌`);
            expect(row.textContent).not.toContain(`├`);
            expect(row.textContent).not.toContain(`└`);
        }
    });

    it(`active row carries the VSCode-style left accent indicator (::before bar via CSS)`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        // The active row's wrapper carries the `before:` utility classes
        // that paint the 1 px accent bar at left:0.
        expect(rows[0].className).toMatch(/before:absolute/);
        expect(rows[0].className).toMatch(/before:left-0/);
        expect(rows[0].className).toMatch(/before:bg-primary/);
        // The inactive row does NOT.
        expect(rows[1].className).not.toMatch(/before:bg-primary/);
    });

    it(`hover Kill closes the terminal and falls back to a sensible neighbour`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        const list = tabListOf(container);
        // Make the SECOND row active so we exercise the fallback path.
        const rows = within(list).getAllByRole(`tab`);
        fireEvent.click(rows[1]);
        const killBtn = within(list).getByRole(`button`, {
            name: `Kill Terminal 2`
        });
        act(() => fireEvent.click(killBtn));
        const after = within(tabListOf(container)).getAllByRole(`tab`);
        expect(after).toHaveLength(1);
        expect(after[0]).toHaveTextContent(`Terminal 1`);
        expect(after[0]).toHaveAttribute(`aria-selected`, `true`);
    });

    it(`closing the last terminal in a group drops the group entirely`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        expect(groupCount(container)).toBe(2);
        const killBtn = within(tabListOf(container)).getByRole(`button`, {
            name: `Kill Terminal 1`
        });
        act(() => fireEvent.click(killBtn));
        expect(groupCount(container)).toBe(1);
        expect(
            within(tabListOf(container)).getAllByRole(`tab`)
        ).toHaveLength(1);
    });

    it(`double-click → rename → Enter commits the new name`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }]}
            />
        );
        const tab = within(tabListOf(container)).getByRole(`tab`);
        fireEvent.doubleClick(tab);
        const input = screen.getByDisplayValue(`Terminal 1`) as HTMLInputElement;
        fireEvent.change(input, { target: { value: `build logs` } });
        fireEvent.keyDown(input, { key: `Enter` });
        expect(within(tabListOf(container)).getByRole(`tab`)).toHaveTextContent(
            `build logs`
        );
    });

    it(`shows the type-picker chevron when more than one console type is registered`, () => {
        render(
            <ConsoleManager
                types={[
                    dummyType(`term`, `Terminal`),
                    dummyType(`logs`, `Logs`)
                ]}
                defaultTypeId={`term`}
            />
        );
        expect(
            screen.getByRole(`button`, { name: `New Terminal` })
        ).toBeInTheDocument();
        expect(
            screen.getByRole(`button`, {
                name: `Open new console of a specific type`
            })
        ).toBeInTheDocument();
    });

    it(`keeps all group bodies mounted so xterm state survives a group switch`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        // Two seeded → two groups → two body instances rendered (one
        // visible, one invisible-but-mounted).
        expect(screen.getAllByTestId(`body-term`).length).toBe(2);
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        fireEvent.click(rows[1]);
        expect(screen.getAllByTestId(`body-term`).length).toBe(2);
    });

    it(`drag-reorder: dragging a sibling onto another in the same group rewires the split tree`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }]}
            />
        );
        // Build a 2-sibling group via Split.
        act(() =>
            fireEvent.click(
                within(tabListOf(container)).getByRole(`button`, {
                    name: /^Split Terminal /
                })
            )
        );
        const before = within(tabListOf(container)).getAllByRole(`tab`);
        expect(before).toHaveLength(2);
        expect(before[0]).toHaveTextContent(`Terminal 1`);
        expect(before[1]).toHaveTextContent(`Terminal 2`);

        const dt = makeDataTransfer();
        fireEvent.dragStart(before[0], { dataTransfer: dt });
        const rect = (before[1] as HTMLElement).getBoundingClientRect();
        // Bottom half → "after".
        fireEvent.dragOver(before[1], {
            dataTransfer: dt,
            clientY: rect.top + rect.height - 1,
            clientX: rect.left + 1
        });
        fireEvent.drop(before[1], { dataTransfer: dt });
        fireEvent.dragEnd(before[0], { dataTransfer: dt });

        const after = within(tabListOf(container)).getAllByRole(`tab`);
        expect(after[0]).toHaveTextContent(`Terminal 2`);
        expect(after[1]).toHaveTextContent(`Terminal 1`);
        // Still one group.
        expect(groupCount(container)).toBe(1);
    });

    it(`drag cross-group: pulling a terminal out of one group into another collapses the empty source group`, () => {
        const { container } = render(
            <ConsoleManager
                types={[dummyType(`term`, `Terminal`)]}
                initialTabs={[{ typeId: `term` }, { typeId: `term` }]}
            />
        );
        expect(groupCount(container)).toBe(2);
        const rows = within(tabListOf(container)).getAllByRole(`tab`);
        const dt = makeDataTransfer();
        fireEvent.dragStart(rows[0], { dataTransfer: dt });
        const rect = (rows[1] as HTMLElement).getBoundingClientRect();
        // Top half → "before": new wrapping split puts the moved
        // terminal first.
        fireEvent.dragOver(rows[1], {
            dataTransfer: dt,
            clientY: rect.top + 1,
            clientX: rect.left + 1
        });
        fireEvent.drop(rows[1], { dataTransfer: dt });
        fireEvent.dragEnd(rows[0], { dataTransfer: dt });
        // Source group is empty → dropped. One group, two siblings.
        expect(groupCount(container)).toBe(1);
        expect(
            within(tabListOf(container)).getAllByRole(`tab`)
        ).toHaveLength(2);
    });

    describe(`persistenceKey`, () => {
        const KEY = `test-persist`;
        const STORAGE_KEY = `mows:console:${KEY}`;

        beforeEach(() => {
            window.localStorage.removeItem(STORAGE_KEY);
        });

        it(`writes groups/tabs/activeTabId to localStorage after a + click`, () => {
            const { container } = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            // The seed write happens after the first state change. Open
            // a second group via the + button so we have something to
            // round-trip.
            fireEvent.click(screen.getByRole(`button`, { name: `New Terminal` }));
            expect(groupCount(container)).toBe(2);
            const raw = window.localStorage.getItem(STORAGE_KEY);
            expect(raw, `localStorage entry should exist after a state change`).not.toBeNull();
            const parsed = JSON.parse(raw!);
            expect(parsed.groups).toHaveLength(2);
            expect(Object.keys(parsed.tabs)).toHaveLength(2);
            expect(parsed.activeTabId).toBeTruthy();
        });

        it(`rehydrates groups + tabs from localStorage on a fresh mount, ignoring initialTabs`, () => {
            // Step 1: prime localStorage by running a manager with the
            // key, then unmounting.
            const first = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            fireEvent.click(screen.getByRole(`button`, { name: `New Terminal` }));
            fireEvent.click(screen.getByRole(`button`, { name: `New Terminal` }));
            expect(groupCount(first.container)).toBe(3);
            first.unmount();

            // Step 2: a brand-new mount with a totally different
            // initialTabs must surface the stored layout, not the seed.
            const second = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            expect(groupCount(second.container)).toBe(3);
            second.unmount();
        });

        it(`drops persisted tabs whose typeId is no longer registered`, () => {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    groups: [
                        { id: `grp_a`, layout: { kind: `terminal`, tabId: `tab_keep` } },
                        { id: `grp_b`, layout: { kind: `terminal`, tabId: `tab_drop` } }
                    ],
                    activeTabId: `tab_drop`,
                    tabs: {
                        tab_keep: { id: `tab_keep`, typeId: `term`, name: `Terminal 1` },
                        tab_drop: {
                            id: `tab_drop`,
                            typeId: `gone-from-registry`,
                            name: `Gone 1`
                        }
                    }
                })
            );

            const { container } = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            // Only the still-known type survives; activeTabId falls back
            // to a valid tab from the surviving groups.
            expect(groupCount(container)).toBe(1);
            const rows = within(tabListOf(container)).getAllByRole(`tab`);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toHaveTextContent(`Terminal 1`);
            expect(rows[0]).toHaveAttribute(`aria-selected`, `true`);
        });

        it(`falls back to initialTabs when the stored layout becomes empty after validation`, () => {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    groups: [
                        { id: `grp_a`, layout: { kind: `terminal`, tabId: `tab_drop` } }
                    ],
                    activeTabId: `tab_drop`,
                    tabs: {
                        tab_drop: {
                            id: `tab_drop`,
                            typeId: `gone-from-registry`,
                            name: `Gone 1`
                        }
                    }
                })
            );

            const { container } = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            // Hydration produced zero valid groups → fallback to the
            // seed, which is a single Terminal 1 tab.
            expect(groupCount(container)).toBe(1);
            const rows = within(tabListOf(container)).getAllByRole(`tab`);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toHaveTextContent(`Terminal 1`);
        });

        it(`treats malformed JSON as no persisted state and falls back to initialTabs`, () => {
            window.localStorage.setItem(STORAGE_KEY, `not-json{`);
            const { container } = render(
                <ConsoleManager
                    types={[dummyType(`term`, `Terminal`)]}
                    initialTabs={[{ typeId: `term` }]}
                    persistenceKey={KEY}
                />
            );
            expect(groupCount(container)).toBe(1);
        });
    });
});
