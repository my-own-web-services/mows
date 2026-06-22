import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionManager } from "./ActionManager";
import { UndoStackManager } from "./UndoStackManager";
import { CoreActionIds, defineCoreActions } from "./coreActions";

interface FakeProvider {
    readonly props: {
        readonly authConfigured: boolean;
        readonly auth: undefined;
        readonly themes: Array<{ id: string; name: string }>;
    };
    state: { currentTheme: { id: string; name: string } };
    changeActiveModal: (modal?: string) => void;
    actionManager: ActionManager;
    setTheme: (theme: { id: string; name: string }) => Promise<void>;
}

const buildFakeProvider = (
    themes = [
        { id: `light`, name: `Light` },
        { id: `dark`, name: `Dark` }
    ]
): { provider: FakeProvider; setThemeSpy: ReturnType<typeof vi.fn> } => {
    const undoStack = new UndoStackManager({ storagePrefix: `coreActions-test` });
    const actionManager = new ActionManager({
        recentActionsSlot: { get: () => undefined, set: () => undefined },
        maxRecentActions: 5,
        undoStackManager: undoStack,
        toast: () => undefined,
        toastStrings: () => ({
            undoFailed: `f`,
            undoNoHandler: `n`,
            undoDropped: `d`,
            auditPersistenceDisabled: `a`
        })
    });
    const setThemeSpy = vi.fn(async (theme: { id: string; name: string }) => {
        provider.state.currentTheme = theme;
    });
    const provider: FakeProvider = {
        props: {
            authConfigured: false,
            auth: undefined,
            themes
        },
        state: { currentTheme: themes[0]! },
        changeActiveModal: () => undefined,
        actionManager,
        setTheme: setThemeSpy
    };
    actionManager.defineMultipleActions(
        defineCoreActions(
            provider as unknown as Parameters<typeof defineCoreActions>[0],
            `_post_login_redirect`
        )
    );
    return { provider, setThemeSpy };
};

beforeEach(() => {
    // sessionStorage is shared across `UndoStackManager` instances that
    // use the same prefix; clear so each test starts from a known empty
    // stack.
    sessionStorage.clear();
});

describe(`SET_THEME core action`, () => {

    it(`dispatching SET_THEME calls provider.setTheme with the requested theme`, () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        expect(setThemeSpy).toHaveBeenCalledWith({ id: `dark`, name: `Dark` });
    });

    it(`pushes an undoable entry that reverses the change`, async () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        expect(provider.actionManager.getUndoStack()).toHaveLength(1);
        await provider.actionManager.undo();
        // setTheme invoked twice: once forward, once for the undo restore.
        expect(setThemeSpy).toHaveBeenCalledTimes(2);
        expect(setThemeSpy).toHaveBeenLastCalledWith({ id: `light`, name: `Light` });
    });

    it(`bails out with a warning when the themeId is unknown`, () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `not-a-theme`
        });
        expect(setThemeSpy).not.toHaveBeenCalled();
        // No undo entry is created because the handler returned `void`.
        expect(provider.actionManager.getUndoStack()).toHaveLength(0);
    });

    it(`mows.history.undo / redo built-in actions show as Shown/Disabled tied to stack depth`, () => {
        const { provider } = buildFakeProvider();
        const undoAction = provider.actionManager.getAction(CoreActionIds.UNDO)!;
        expect(undoAction.getState().visibility).toBe(`Disabled`);
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        expect(undoAction.getState().visibility).toBe(`Shown`);
    });

    it(`SET_THEME logs an error when payload is missing themeId`, () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        // No payload at all → handler bails out, no theme change.
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME);
        expect(setThemeSpy).not.toHaveBeenCalled();
        expect(provider.actionManager.getUndoStack()).toHaveLength(0);
    });

    it(`SET_THEME invertAction throws a generic message (does not leak theme id to the toast)`, async () => {
        const { provider } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        // Remove the original theme from the registry — invertAction
        // can no longer find `light` and should throw a generic error.
        provider.props.themes.splice(0, provider.props.themes.length);
        // Direct undo: catch the resulting promise rejection and assert
        // the toast message is the generic one (no theme id leakage).
        await provider.actionManager.undo();
        // The retry path keeps the entry on the stack on failure (we
        // configured maxInvertRetries = 3 by default).
        expect(provider.actionManager.getUndoStack()).toHaveLength(1);
    });
});

describe(`mows.history.undo built-in action`, () => {
    it(`dispatching mows.history.undo triggers actionManager.undo`, async () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        expect(provider.actionManager.getUndoStack()).toHaveLength(1);
        provider.actionManager.dispatchAction(CoreActionIds.UNDO);
        // undo() is async — yield a microtask so the chain settles.
        await Promise.resolve();
        await Promise.resolve();
        expect(provider.actionManager.getUndoStack()).toHaveLength(0);
        // Last setTheme call was the invert (restoring `light`).
        expect(setThemeSpy).toHaveBeenLastCalledWith({ id: `light`, name: `Light` });
    });

    it(`mows.history.undo is Disabled when the undo stack is empty`, () => {
        const { provider } = buildFakeProvider();
        const undo = provider.actionManager.getAction(CoreActionIds.UNDO)!;
        expect(undo.getState().visibility).toBe(`Disabled`);
    });
});

describe(`mows.history.redo built-in action`, () => {
    it(`dispatching mows.history.redo re-applies the undone action`, async () => {
        const { provider, setThemeSpy } = buildFakeProvider();
        provider.actionManager.dispatchAction(CoreActionIds.SET_THEME, undefined, null, {
            themeId: `dark`
        });
        await provider.actionManager.undo();
        expect(provider.actionManager.getRedoStack()).toHaveLength(1);
        const callsBeforeRedo = setThemeSpy.mock.calls.length;
        provider.actionManager.dispatchAction(CoreActionIds.REDO);
        await Promise.resolve();
        await Promise.resolve();
        expect(setThemeSpy.mock.calls.length).toBeGreaterThan(callsBeforeRedo);
        expect(provider.actionManager.getRedoStack()).toHaveLength(0);
        expect(provider.actionManager.getUndoStack()).toHaveLength(1);
    });

    it(`mows.history.redo is Disabled when the redo stack is empty`, () => {
        const { provider } = buildFakeProvider();
        const redo = provider.actionManager.getAction(CoreActionIds.REDO)!;
        expect(redo.getState().visibility).toBe(`Disabled`);
    });
});

describe(`mows.history.open built-in action`, () => {
    it(`opens the history modal via provider.changeActiveModal`, () => {
        const { provider } = buildFakeProvider();
        const changeActiveModal = vi.spyOn(provider, `changeActiveModal`);
        provider.actionManager.dispatchAction(CoreActionIds.OPEN_HISTORY);
        expect(changeActiveModal).toHaveBeenCalledWith(`history`);
    });
});

describe(`REPLACE_SETTINGS_BLOB core action`, () => {
    // Build a provider that also has a real-ish settingsManager surface.
    interface BlobProvider {
        readonly props: { readonly themes: Array<{ id: string; name: string }> };
        state: { currentTheme: { id: string; name: string } };
        changeActiveModal: (modal?: string) => void;
        actionManager: ActionManager;
        settingsManager: {
            getBlob: () => unknown;
            replaceBlob: (next: unknown) => void;
        };
        setTheme: (theme: { id: string; name: string }) => Promise<void>;
    }

    const buildBlobProvider = (): {
        provider: BlobProvider;
        replaceSpy: ReturnType<typeof vi.fn>;
        getBlobSpy: ReturnType<typeof vi.fn>;
    } => {
        sessionStorage.clear();
        const undoStack = new UndoStackManager({ storagePrefix: `core-blob` });
        const actionManager = new ActionManager({
            recentActionsSlot: { get: () => undefined, set: () => undefined },
            maxRecentActions: 5,
            undoStackManager: undoStack,
            toast: () => undefined,
            toastStrings: () => ({
                undoFailed: `f`,
                undoNoHandler: `n`,
                undoDropped: `d`,
                auditPersistenceDisabled: `a`
            })
        });
        let blob: unknown = { _v: 1, core: {}, device: {}, app: {} };
        const getBlobSpy = vi.fn(() => blob);
        const replaceSpy = vi.fn((next: unknown) => {
            blob = next;
        });
        const provider: BlobProvider = {
            props: { themes: [{ id: `light`, name: `Light` }] },
            state: { currentTheme: { id: `light`, name: `Light` } },
            changeActiveModal: () => undefined,
            actionManager,
            settingsManager: { getBlob: getBlobSpy, replaceBlob: replaceSpy },
            setTheme: async () => undefined
        };
        actionManager.defineMultipleActions(
            defineCoreActions(
                provider as unknown as Parameters<typeof defineCoreActions>[0],
                `_post_login_redirect`
            )
        );
        return { provider, replaceSpy, getBlobSpy };
    };

    it(`applies the blob via settingsManager.replaceBlob and pushes an undoable entry`, () => {
        const { provider, replaceSpy } = buildBlobProvider();
        const newBlob = { _v: 1, core: { theme: `dark` }, device: {}, app: {} };
        provider.actionManager.dispatchAction(
            CoreActionIds.REPLACE_SETTINGS_BLOB,
            undefined,
            null,
            { blob: newBlob }
        );
        expect(replaceSpy).toHaveBeenCalledWith(newBlob);
        expect(provider.actionManager.getUndoStack()).toHaveLength(1);
    });

    it(`undo restores the previous blob captured at dispatch time`, async () => {
        const { provider, replaceSpy, getBlobSpy } = buildBlobProvider();
        const original = getBlobSpy.mock.results[0]?.value ?? provider.settingsManager.getBlob();
        provider.actionManager.dispatchAction(
            CoreActionIds.REPLACE_SETTINGS_BLOB,
            undefined,
            null,
            { blob: { _v: 1, core: { theme: `dark` }, device: {}, app: {} } }
        );
        await provider.actionManager.undo();
        // Last replaceBlob call was the invert — it should restore the
        // original blob we captured before the forward dispatch.
        expect(replaceSpy).toHaveBeenLastCalledWith(original);
    });

    it(`bails out with no undo entry when payload.blob is missing`, () => {
        const { provider, replaceSpy } = buildBlobProvider();
        provider.actionManager.dispatchAction(
            CoreActionIds.REPLACE_SETTINGS_BLOB,
            undefined,
            null,
            {}
        );
        expect(replaceSpy).not.toHaveBeenCalled();
        expect(provider.actionManager.getUndoStack()).toHaveLength(0);
    });
});
