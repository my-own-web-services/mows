import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from "./input-group";

describe(`InputGroup`, () => {
    it(`renders a role="group" wrapper with the input + leading addon`, () => {
        render(
            <InputGroup>
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder={`Search…`} />
            </InputGroup>
        );
        // The wrapper carries role="group" with the InputGroupAddon nested
        // inside (which is also a role="group"). The outermost one is the
        // input-group itself.
        const groups = screen.getAllByRole(`group`);
        expect(groups.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByPlaceholderText(`Search…`)).toBeInTheDocument();
    });

    it(`focuses the inner input when the addon is clicked`, async () => {
        const user = userEvent.setup();
        render(
            <InputGroup>
                <InputGroupAddon data-testid={`addon`}>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder={`Search…`} />
            </InputGroup>
        );
        const input = screen.getByPlaceholderText(`Search…`);
        expect(input).not.toHaveFocus();
        await user.click(screen.getByTestId(`addon`));
        expect(input).toHaveFocus();
    });

    it(`addon align="inline-end" places the addon last (data-align attribute)`, () => {
        render(
            <InputGroup>
                <InputGroupInput placeholder={`x`} />
                <InputGroupAddon data-testid={`addon`} align={`inline-end`}>
                    <Search />
                </InputGroupAddon>
            </InputGroup>
        );
        const addon = screen.getByTestId(`addon`);
        expect(addon).toHaveAttribute(`data-align`, `inline-end`);
        expect(addon.className).toMatch(/order-last/);
    });

    it(`addon align defaults to inline-start when omitted`, () => {
        render(
            <InputGroup>
                <InputGroupAddon data-testid={`addon`}>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder={`x`} />
            </InputGroup>
        );
        const addon = screen.getByTestId(`addon`);
        expect(addon).toHaveAttribute(`data-align`, `inline-start`);
        expect(addon.className).toMatch(/order-first/);
    });

    it(`forwards aria-invalid onto the inner input`, () => {
        render(
            <InputGroup>
                <InputGroupInput aria-invalid placeholder={`x`} />
            </InputGroup>
        );
        expect(screen.getByPlaceholderText(`x`)).toHaveAttribute(`aria-invalid`);
    });
});
