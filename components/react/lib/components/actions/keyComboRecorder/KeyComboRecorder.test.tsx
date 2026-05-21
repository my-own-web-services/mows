import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import baseEn from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import { MowsContext, type MowsContextType } from "../../../lib/mowsContext/MowsContext";
import KeyComboRecorder from "./KeyComboRecorder";

const buildContext = (): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `r-am`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, {
        configStorageKey: `r-hk`,
        defaultHotkeys: {}
    });
    return { t: baseEn, hotkeyManager: hm, actionManager: am } as unknown as MowsContextType;
};

const renderRecorder = (extra?: { onCombo?: (c: string) => void }) =>
    render(
        <MowsContext.Provider value={buildContext()}>
            <KeyComboRecorder onCombo={extra?.onCombo} />
        </MowsContext.Provider>
    );

describe(`KeyComboRecorder`, () => {
    it(`renders the start button and hint copy before recording`, () => {
        renderRecorder();
        expect(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.start })
        ).toBeInTheDocument();
        expect(screen.getByText(baseEn.keyComboRecorder.heading)).toBeInTheDocument();
        expect(screen.getByText(baseEn.keyComboRecorder.hint)).toBeInTheDocument();
    });

    it(`flips to a stop button + listening indicator once recording starts`, async () => {
        const user = userEvent.setup();
        renderRecorder();
        await user.click(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.start })
        );
        expect(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.stop })
        ).toBeInTheDocument();
        expect(screen.getByText(baseEn.keyComboRecorder.listening)).toBeInTheDocument();
    });

    it(`captures a real combo as a list entry and fires onCombo`, async () => {
        const user = userEvent.setup();
        const onCombo = vi.fn();
        renderRecorder({ onCombo });
        await user.click(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.start })
        );
        // Dispatch a synthetic keydown event for the "p" key with no
        // modifiers — HotkeyManager.formatKeyCombo should yield "p".
        fireEvent.keyDown(window, { key: `p` });
        const list = screen.getByTestId(`keycombo-recorder-list`);
        expect(list).toBeInTheDocument();
        expect(list).toHaveTextContent(`p`);
        expect(onCombo).toHaveBeenCalledWith(`p`);
    });

    it(`captures a standalone modifier release (Shift down → Shift up with no key in between)`, async () => {
        const user = userEvent.setup();
        const onCombo = vi.fn();
        renderRecorder({ onCombo });
        await user.click(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.start })
        );
        fireEvent.keyDown(window, { key: `Shift` });
        fireEvent.keyUp(window, { key: `Shift` });
        expect(onCombo).toHaveBeenCalledWith(`shift`);
    });

    it(`clear button resets the captured list`, async () => {
        const user = userEvent.setup();
        renderRecorder();
        await user.click(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.start })
        );
        fireEvent.keyDown(window, { key: `p` });
        expect(screen.getByTestId(`keycombo-recorder-list`)).toBeInTheDocument();
        await user.click(
            screen.getByRole(`button`, { name: baseEn.keyComboRecorder.clear })
        );
        expect(screen.queryByTestId(`keycombo-recorder-list`)).not.toBeInTheDocument();
    });
});
