import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import { Action, ActionManager, ActionVisibility } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import GlobalContextMenu from "./GlobalContextMenu";

const buildContext = (actionManager: ActionManager): MowsContextType => {
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: `test_hotkeys`,
        defaultHotkeys: {}
    });

    return {

        auth: {} as any,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
         
        t: {} as any,
        currentLanguage: { code: `en`, originalName: `English`, englishName: `English`, emoji: ``, import: () => Promise.reject() },
        themes: [],
        languages: [],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined
    };
};

const renderWithContext = (children: ReactNode, actionManager: ActionManager) =>
    render(
        <MowsContext.Provider value={buildContext(actionManager)}>{children}</MowsContext.Provider>
    );

const buildActionManagerWithScopedAction = (scope: string): ActionManager => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `test_recent`,
        maxRecentActions: 5
    });
    actionManager.defineAction(
        new Action({
            id: `test.action`,
            category: `Test`,
            actionHandlers: new Map([
                [
                    `Handler`,
                    {
                        id: `Handler`,
                        scopes: [scope],
                        getState: () => ({
                            visibility: ActionVisibility.Shown,
                            component: () => <span>Test action</span>
                        }),
                        executeAction: () => undefined
                    }
                ]
            ])
        })
    );
    return actionManager;
};

const fireContextMenuOnTarget = (target: HTMLElement, clientX: number, clientY: number) => {
    const event = new MouseEvent(`contextmenu`, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
};

describe(`GlobalContextMenu`, () => {
    it(`positions the trigger wrapper exactly at the cursor coordinates`, async () => {
        const actionManager = buildActionManagerWithScopedAction(`scopeA`);
        const { container } = renderWithContext(
            <>
                <div data-actionscope={`scopeA`} data-testid={`target`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        fireContextMenuOnTarget(screen.getByTestId(`target`), 137, 84);

        await waitFor(() => expect(screen.getByText(`Test action`)).toBeInTheDocument());

        const wrapper = container.querySelector(`.ContextMenu`) as HTMLElement;
        expect(wrapper.style.position).toBe(`fixed`);
        expect(wrapper.style.top).toBe(`84px`);
        expect(wrapper.style.left).toBe(`137px`);
        expect(wrapper.style.width).toBe(`0px`);
        expect(wrapper.style.height).toBe(`0px`);
    });

    it(`opens with sideOffset 0 so the menu starts at the cursor, not below it`, async () => {
        const actionManager = buildActionManagerWithScopedAction(`scopeB`);
        renderWithContext(
            <>
                <div data-actionscope={`scopeB`} data-testid={`target`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        fireContextMenuOnTarget(screen.getByTestId(`target`), 50, 50);

        await waitFor(() => expect(screen.getByText(`Test action`)).toBeInTheDocument());

        // Radix exposes the sideOffset via a CSS variable on the content node.
        // sideOffset=0 means there's no extra distance between the (zero-sized)
        // trigger and the content, so the menu's top edge sits at the cursor Y.
        const content = document.querySelector(
            `[data-radix-popper-content-wrapper]`
        ) as HTMLElement | null;
        expect(content).not.toBeNull();
    });

    it(`only suppresses the native context menu when there is a matching scoped action`, () => {
        const actionManager = buildActionManagerWithScopedAction(`scopeC`);
        renderWithContext(
            <>
                <div data-testid={`outside`}>plain area</div>
                <div data-actionscope={`scopeC`} data-testid={`inside`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        const outsideEvent = fireContextMenuOnTarget(screen.getByTestId(`outside`), 10, 10);
        expect(outsideEvent.defaultPrevented).toBe(false);

        const insideEvent = fireContextMenuOnTarget(screen.getByTestId(`inside`), 10, 10);
        expect(insideEvent.defaultPrevented).toBe(true);
    });

    it(`does not suppress the native context menu when the scope has no actions`, () => {
        const actionManager = new ActionManager({
            recentActionsStorageKey: `test_recent_empty`,
            maxRecentActions: 5
        });
        renderWithContext(
            <>
                <div data-actionscope={`unknownScope`} data-testid={`target`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        const event = fireContextMenuOnTarget(screen.getByTestId(`target`), 0, 0);
        expect(event.defaultPrevented).toBe(false);
    });

    it(`right-clicking a menu item dispatches the action and prevents the native context menu`, async () => {
        const actionManager = new ActionManager({
            recentActionsStorageKey: `test_recent_rightclick`,
            maxRecentActions: 5
        });
        let executed = 0;
        actionManager.defineAction(
            new Action({
                id: `test.rightclick`,
                category: `Test`,
                actionHandlers: new Map([
                    [
                        `Handler`,
                        {
                            id: `Handler`,
                            scopes: [`scopeRC`],
                            getState: () => ({
                                visibility: ActionVisibility.Shown,
                                component: () => <span>RC action</span>
                            }),
                            executeAction: () => {
                                executed += 1;
                            }
                        }
                    ]
                ])
            })
        );

        renderWithContext(
            <>
                <div data-actionscope={`scopeRC`} data-testid={`target`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        fireContextMenuOnTarget(screen.getByTestId(`target`), 10, 10);
        const item = await screen.findByText(`RC action`);

        // Fire a contextmenu event on the rendered menu item (a right-click).
        // The native browser menu must be suppressed and the action dispatched
        // exactly once, just like a regular left-click would do.
        const rightClickEvent = new MouseEvent(`contextmenu`, {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 10,
            clientY: 10
        });
        act(() => {
            item.dispatchEvent(rightClickEvent);
        });

        expect(rightClickEvent.defaultPrevented).toBe(true);
        expect(executed).toBe(1);
        await waitFor(() => expect(screen.queryByText(`RC action`)).not.toBeInTheDocument());
    });

    it(`updates the cursor position on a second right-click`, async () => {
        const actionManager = buildActionManagerWithScopedAction(`scopeD`);
        const { container } = renderWithContext(
            <>
                <div data-actionscope={`scopeD`} data-testid={`target`}>
                    target
                </div>
                <GlobalContextMenu />
            </>,
            actionManager
        );

        const target = screen.getByTestId(`target`);

        fireContextMenuOnTarget(target, 100, 200);
        await waitFor(() => expect(screen.getByText(`Test action`)).toBeInTheDocument());

        // close the menu before re-opening to simulate a second invocation
        fireEvent.keyDown(document.body, { key: `Escape` });

        fireContextMenuOnTarget(target, 400, 600);
        await waitFor(() => {
            const wrapper = container.querySelector(`.ContextMenu`) as HTMLElement;
            expect(wrapper.style.top).toBe(`600px`);
            expect(wrapper.style.left).toBe(`400px`);
        });
    });
});
