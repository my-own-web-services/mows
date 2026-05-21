import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const Basic = (props: React.ComponentProps<typeof Collapsible> = {}) => (
    <Collapsible {...props}>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden body</CollapsibleContent>
    </Collapsible>
);

describe(`Collapsible`, () => {
    it(`renders closed by default`, () => {
        render(<Basic />);
        const trigger = screen.getByRole(`button`, { name: `Toggle` });
        expect(trigger).toHaveAttribute(`data-state`, `closed`);
        expect(trigger).toHaveAttribute(`aria-expanded`, `false`);
    });

    it(`reflects defaultOpen on first mount`, () => {
        render(<Basic defaultOpen />);
        expect(screen.getByRole(`button`, { name: `Toggle` })).toHaveAttribute(
            `data-state`,
            `open`
        );
        expect(screen.getByText(`Hidden body`)).toBeInTheDocument();
    });

    it(`opens and closes on trigger click`, async () => {
        const user = userEvent.setup();
        render(<Basic />);
        const trigger = screen.getByRole(`button`, { name: `Toggle` });
        await user.click(trigger);
        expect(trigger).toHaveAttribute(`data-state`, `open`);
        await user.click(trigger);
        expect(trigger).toHaveAttribute(`data-state`, `closed`);
    });

    it(`fires onOpenChange when toggled`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(<Basic onOpenChange={onOpenChange} />);
        await user.click(screen.getByRole(`button`, { name: `Toggle` }));
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it(`is fully controllable via open + onOpenChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <Collapsible open={open} onOpenChange={setOpen}>
                        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
                        <CollapsibleContent>Body</CollapsibleContent>
                    </Collapsible>
                    <span data-testid={`v`}>{String(open)}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`v`)).toHaveTextContent(`false`);
        await user.click(screen.getByRole(`button`, { name: `Toggle` }));
        expect(screen.getByTestId(`v`)).toHaveTextContent(`true`);
    });

    it(`does not toggle when disabled`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(<Basic disabled onOpenChange={onOpenChange} />);
        const trigger = screen.getByRole(`button`, { name: `Toggle` });
        await user.click(trigger);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(trigger).toHaveAttribute(`data-state`, `closed`);
    });
});
