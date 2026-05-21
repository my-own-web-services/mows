import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "./dropdown-menu";

const renderDropdown = (opts: { onSelect?: () => void } = {}) =>
    render(
        <DropdownMenu>
            <DropdownMenuTrigger>open</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={opts.onSelect}>Profile</DropdownMenuItem>
                <DropdownMenuItem disabled>Sign out (disabled)</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

describe(`DropdownMenu`, () => {
    it(`is closed by default — no menu items rendered`, () => {
        renderDropdown();
        expect(screen.queryByText(`Profile`)).not.toBeInTheDocument();
    });

    it(`opens when the trigger is clicked`, async () => {
        const user = userEvent.setup();
        renderDropdown();
        await user.click(screen.getByText(`open`));
        expect(screen.getByText(`Profile`)).toBeInTheDocument();
        expect(screen.getByText(`Account`)).toBeInTheDocument();
    });

    it(`fires onSelect when an item is clicked, then closes`, async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        renderDropdown({ onSelect });
        await user.click(screen.getByText(`open`));
        await user.click(screen.getByText(`Profile`));
        expect(onSelect).toHaveBeenCalled();
        expect(screen.queryByText(`Profile`)).not.toBeInTheDocument();
    });

    it(`disabled items are exposed via data-disabled`, async () => {
        const user = userEvent.setup();
        renderDropdown();
        await user.click(screen.getByText(`open`));
        const item = screen.getByText(`Sign out (disabled)`).closest(`[role="menuitem"]`);
        expect(item).toHaveAttribute(`data-disabled`);
    });

    it(`closes on Escape`, async () => {
        const user = userEvent.setup();
        renderDropdown();
        await user.click(screen.getByText(`open`));
        await user.keyboard(`{Escape}`);
        expect(screen.queryByText(`Profile`)).not.toBeInTheDocument();
    });

    it(`label has role="presentation" (not a menuitem)`, async () => {
        const user = userEvent.setup();
        renderDropdown();
        await user.click(screen.getByText(`open`));
        // Radix DropdownMenuLabel does NOT carry role="menuitem" so it is not in the navigation cycle.
        const label = screen.getByText(`Account`);
        expect(label.closest(`[role="menuitem"]`)).toBeNull();
    });
});
