import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    Action,
    ActionManager,
    ActionVisibility,
    type ActionHandler,
    type UndoableAction
} from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import { UndoStackManager } from "../../../lib/mowsContext/UndoStackManager";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import HistoryPanel from "./HistoryPanel";

const makeUndoable = (
    id: string,
    category = `Files`,
    handlerOverrides: Partial<ActionHandler> = {},
    inversePayload: unknown = { prev: `state` }
): Action =>
    new Action({
        id,
        category,
        actionHandlers: new Map([
            [
                `h`,
                {
                    id: `h`,
                    getState: () => ({ visibility: ActionVisibility.Shown }),
                    executeAction: () => ({
                        id: `${id}-undo`,
                        actionId: id,
                        inversePayload,
                        timestamp: Date.now(),
                        describe: { labelKey: `actions.${id}` }
                    }),
                    invertAction: vi.fn(),
                    ...handlerOverrides
                }
            ]
        ])
    });

interface Rig {
    manager: ActionManager;
    context: MowsContextType;
    undoStack: UndoStackManager;
}

const buildRig = (
    populate: (manager: ActionManager) => void = () => undefined
): Rig => {
    // Use real ActionManager + UndoStackManager — the panel uses the
    // manager's public API surface end-to-end, no mocks.
    const session = new Map<string, string>();
    const undoStack = new UndoStackManager({
        storagePrefix: `panel-test`,
        storage: {
            getItem: (k) => session.get(k) ?? null,
            setItem: (k, v) => {
                session.set(k, v);
            },
            removeItem: (k) => {
                session.delete(k);
            }
        }
    });
    const auditValues = new Map<string, unknown>();
    const auditSlot = {
        get: () => auditValues.get(`audit`),
        set: (v: unknown) => {
            auditValues.set(`audit`, v);
        }
    };
    const manager = new ActionManager({
        recentActionsSlot: { get: () => undefined, set: () => undefined },
        maxRecentActions: 5,
        auditLogSlot: auditSlot as never,
        undoStackManager: undoStack,
        toast: () => undefined,
        toastStrings: () => ({
            undoFailed: `f`,
            undoNoHandler: `n`,
            undoDropped: `d`,
            auditPersistenceDisabled: `a`
        })
    });
    const hotkey = new HotkeyManager(manager, {
        configStorageKey: `panel-test-hk`,
        defaultHotkeys: {}
    });
    populate(manager);
    const context = {
        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `panel-test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEn,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager: manager,
        hotkeyManager: hotkey,
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
    return { manager, context, undoStack };
};

const renderPanel = (rig: Rig) =>
    render(
        <MowsContext.Provider value={rig.context}>
            <HistoryPanel />
        </MowsContext.Provider>
    );

describe(`HistoryPanel`, () => {
    it(`renders the empty state when the audit log is empty`, () => {
        const rig = buildRig();
        renderPanel(rig);
        expect(screen.getByText(baseEn.historyPanel.emptyState)).toBeInTheDocument();
    });

    it(`renders one row per audit entry, newest first`, () => {
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`));
            manager.defineAction(makeUndoable(`actions.rename`));
            manager.dispatchAction(`actions.move`);
            manager.dispatchAction(`actions.rename`);
        });
        renderPanel(rig);
        const items = screen.getAllByRole(`listitem`);
        expect(items).toHaveLength(2);
        // First row is the most recent dispatch (rename).
        expect(items[0]!).toHaveTextContent(`actions.rename`);
        expect(items[1]!).toHaveTextContent(`actions.move`);
    });

    it(`filters by the search box`, async () => {
        const user = userEvent.setup();
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`));
            manager.defineAction(makeUndoable(`actions.rename`));
            manager.dispatchAction(`actions.move`);
            manager.dispatchAction(`actions.rename`);
        });
        renderPanel(rig);
        await user.type(
            screen.getByLabelText(baseEn.historyPanel.searchPlaceholder),
            `move`
        );
        const items = screen.getAllByRole(`listitem`);
        expect(items).toHaveLength(1);
        expect(items[0]!).toHaveTextContent(`actions.move`);
    });

    it(`shows the "undo to here" affordance only for undoable entries in this tab`, () => {
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`));
            manager.dispatchAction(`actions.move`);
        });
        renderPanel(rig);
        const undoButtons = screen.getAllByRole(`button`, {
            name: baseEn.historyPanel.undoToHere
        });
        expect(undoButtons).toHaveLength(1);
    });

    it(`clicking "undo to here" invokes the handler invertAction`, async () => {
        const user = userEvent.setup();
        const invert = vi.fn();
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`, `Files`, { invertAction: invert }));
            manager.dispatchAction(`actions.move`);
        });
        renderPanel(rig);
        const button = screen.getByRole(`button`, {
            name: baseEn.historyPanel.undoToHere
        });
        await user.click(button);
        // Microtask flush
        await new Promise((r) => setTimeout(r, 0));
        expect(invert).toHaveBeenCalled();
    });

    it(`renders other-tab entries muted, with no undo button`, () => {
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`));
            manager.dispatchAction(`actions.move`);
            // Mutate the most-recent audit entry's tabId to simulate a
            // different tab having written it (via the cross-tab storage
            // event handler in production).
            const log = manager.getAuditLog();
            (log[0] as { tabId: string }).tabId = `other-tab`;
        });
        renderPanel(rig);
        const items = screen.getAllByRole(`listitem`);
        expect(items[0]!).toHaveAttribute(`data-from-other-tab`, `true`);
        expect(
            within(items[0]!).queryByRole(`button`, {
                name: baseEn.historyPanel.undoToHere
            })
        ).not.toBeInTheDocument();
        expect(items[0]!).toHaveTextContent(baseEn.historyPanel.otherTab);
    });

    it(`renders entries for unknown actions with the literal id and a dimmed style`, () => {
        const rig = buildRig((manager) => {
            // Dispatch an action, then unregister it so the audit entry
            // remains but the panel can no longer resolve the handler. This
            // models the real "plugin uninstalled / handler removed" case.
            manager.defineAction(makeUndoable(`actions.disappearing`));
            manager.dispatchAction(`actions.disappearing`);
            manager.getAction(`actions.disappearing`)!.actionHandlers.clear();
        });
        renderPanel(rig);
        const items = screen.getAllByRole(`listitem`);
        expect(items[0]!).toHaveAttribute(`data-unknown-action`, `true`);
        expect(items[0]!).toHaveTextContent(`actions.disappearing`);
        expect(items[0]!).toHaveTextContent(baseEn.historyPanel.unknownAction);
    });

    it(`clear button clears the audit log on the second click`, async () => {
        const user = userEvent.setup();
        const rig = buildRig((manager) => {
            manager.defineAction(makeUndoable(`actions.move`));
            manager.dispatchAction(`actions.move`);
        });
        renderPanel(rig);
        const clear = screen.getByRole(`button`, {
            name: baseEn.historyPanel.clearButton
        });
        await user.click(clear);
        // After first click the label changes to the confirmation prompt.
        expect(
            screen.getByText(baseEn.historyPanel.clearConfirmation)
        ).toBeInTheDocument();
        const confirm = screen.getByText(baseEn.historyPanel.clearConfirmation);
        await user.click(confirm);
        expect(rig.manager.getAuditLog()).toHaveLength(0);
        expect(screen.getByText(baseEn.historyPanel.emptyState)).toBeInTheDocument();
    });

    it(`renders describe.params via React text — never as raw markup (XSS-safe)`, () => {
        const rig = buildRig((manager) => {
            // Action whose `describe.params` contains script-shaped text; the
            // panel currently resolves the labelKey via translation (which
            // doesn't define the key, so falls back to the labelKey itself).
            // The test asserts the param text is escaped if interpolated.
            const action = new Action({
                id: `actions.xss`,
                category: `Test`,
                actionHandlers: new Map([
                    [
                        `h`,
                        {
                            id: `h`,
                            getState: () => ({ visibility: ActionVisibility.Shown }),
                            executeAction: () => ({
                                id: `xss-1`,
                                actionId: `actions.xss`,
                                inversePayload: {},
                                timestamp: Date.now(),
                                describe: {
                                    labelKey: `actions.xss`,
                                    params: { name: `<img src=x onerror=alert(1)>` }
                                }
                            }),
                            invertAction: vi.fn()
                        }
                    ]
                ])
            });
            manager.defineAction(action);
            manager.dispatchAction(`actions.xss`);
        });
        renderPanel(rig);
        // No <img> appears in the rendered DOM; the literal text is what's
        // rendered, escaped by React's default text-node handling.
        expect(document.querySelector(`img[onerror]`)).toBeNull();
    });
});
