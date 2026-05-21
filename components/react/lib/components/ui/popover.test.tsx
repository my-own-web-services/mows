import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const renderPopover = (opts: { defaultOpen?: boolean } = {}) =>
    render(
        <Popover defaultOpen={opts.defaultOpen}>
            <PopoverTrigger>open</PopoverTrigger>
            <PopoverContent>popover body</PopoverContent>
        </Popover>
    );

describe(`Popover`, () => {
    it(`is closed by default — content is not rendered`, () => {
        renderPopover();
        expect(screen.queryByText(`popover body`)).not.toBeInTheDocument();
    });

    it(`renders the content when defaultOpen is set`, () => {
        renderPopover({ defaultOpen: true });
        expect(screen.getByText(`popover body`)).toBeInTheDocument();
    });

    it(`opens when the trigger is clicked`, async () => {
        const user = userEvent.setup();
        renderPopover();
        await user.click(screen.getByText(`open`));
        expect(screen.getByText(`popover body`)).toBeInTheDocument();
    });

    it(`closes on Escape`, async () => {
        const user = userEvent.setup();
        renderPopover({ defaultOpen: true });
        await user.keyboard(`{Escape}`);
        expect(screen.queryByText(`popover body`)).not.toBeInTheDocument();
    });

    it(`portals the content to a separate node (not nested in the trigger's parent div)`, () => {
        const { container } = renderPopover({ defaultOpen: true });
        // The trigger lives inside `container`. The portaled content lives
        // in a sibling node attached to document.body.
        const body = screen.getByText(`popover body`);
        expect(container.contains(body)).toBe(false);
        expect(document.body.contains(body)).toBe(true);
    });
});
