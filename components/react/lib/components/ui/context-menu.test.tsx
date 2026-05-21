import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "./context-menu";

const renderContextMenu = (opts: { onSelect?: () => void } = {}) =>
    render(
        <ContextMenu>
            <ContextMenuTrigger
                data-testid={`area`}
                className={`block h-16 w-32 border-2 border-dashed`}
            >
                trigger area
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onSelect={opts.onSelect}>Mark read</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled>Disabled</ContextMenuItem>
                <ContextMenuItem>Delete</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );

const openContextMenu = (target: HTMLElement) => {
    fireEvent.contextMenu(target);
};

describe(`ContextMenu`, () => {
    it(`is closed by default — no menu items rendered`, () => {
        renderContextMenu();
        expect(screen.queryByText(`Mark read`)).not.toBeInTheDocument();
    });

    it(`opens on contextmenu event on the trigger`, () => {
        renderContextMenu();
        openContextMenu(screen.getByTestId(`area`));
        expect(screen.getByText(`Mark read`)).toBeInTheDocument();
        expect(screen.getByText(`Delete`)).toBeInTheDocument();
    });

    it(`fires onSelect when an item is clicked`, async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        renderContextMenu({ onSelect });
        openContextMenu(screen.getByTestId(`area`));
        await user.click(screen.getByText(`Mark read`));
        expect(onSelect).toHaveBeenCalled();
    });

    it(`disabled items are exposed via aria-disabled and ignore selection`, async () => {
        const user = userEvent.setup();
        renderContextMenu();
        openContextMenu(screen.getByTestId(`area`));
        const disabled = screen.getByText(`Disabled`);
        // Radix exposes data-disabled on the menuitem element.
        expect(disabled.closest(`[role="menuitem"]`)).toHaveAttribute(`data-disabled`);
        await user.click(disabled);
        // Menu stays open because selecting a disabled item is a no-op.
        expect(screen.getByText(`Mark read`)).toBeInTheDocument();
    });

    it(`closes when an enabled item is selected`, async () => {
        const user = userEvent.setup();
        renderContextMenu();
        openContextMenu(screen.getByTestId(`area`));
        await user.click(screen.getByText(`Delete`));
        expect(screen.queryByText(`Mark read`)).not.toBeInTheDocument();
    });

    it(`renders a separator between item groups`, () => {
        renderContextMenu();
        openContextMenu(screen.getByTestId(`area`));
        const sep = document.querySelector(`[role="separator"]`);
        expect(sep).not.toBeNull();
    });
});
