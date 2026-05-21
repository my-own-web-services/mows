import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe(`Checkbox`, () => {
    it(`renders an unchecked checkbox by default`, () => {
        render(<Checkbox aria-label={`x`} />);
        const cb = screen.getByRole(`checkbox`, { name: `x` });
        expect(cb).toHaveAttribute(`data-state`, `unchecked`);
        expect(cb).not.toBeDisabled();
    });

    it(`renders the check indicator only when checked`, () => {
        const { container, rerender } = render(<Checkbox aria-label={`x`} />);
        expect(container.querySelector(`svg`)).toBeNull();
        rerender(<Checkbox aria-label={`x`} checked />);
        expect(container.querySelector(`svg`)).not.toBeNull();
    });

    it(`reflects defaultChecked on first mount`, () => {
        render(<Checkbox aria-label={`x`} defaultChecked />);
        expect(screen.getByRole(`checkbox`, { name: `x` })).toHaveAttribute(
            `data-state`,
            `checked`
        );
    });

    it(`fires onCheckedChange on click (uncontrolled)`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Checkbox aria-label={`x`} onCheckedChange={onChange} />);
        await user.click(screen.getByRole(`checkbox`, { name: `x` }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it(`is fully controllable via checked + onCheckedChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState(false);
            return (
                <>
                    <Checkbox aria-label={`x`} checked={v} onCheckedChange={(c) => setV(c === true)} />
                    <span data-testid={`v`}>{String(v)}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`v`)).toHaveTextContent(`false`);
        await user.click(screen.getByRole(`checkbox`, { name: `x` }));
        expect(screen.getByTestId(`v`)).toHaveTextContent(`true`);
    });

    it(`does not toggle when disabled`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Checkbox aria-label={`x`} disabled onCheckedChange={onChange} />);
        const cb = screen.getByRole(`checkbox`, { name: `x` });
        expect(cb).toBeDisabled();
        await user.click(cb);
        expect(onChange).not.toHaveBeenCalled();
    });

    it(`exposes the indeterminate state via data-state="indeterminate"`, () => {
        render(<Checkbox aria-label={`x`} checked={`indeterminate`} />);
        expect(screen.getByRole(`checkbox`, { name: `x` })).toHaveAttribute(
            `data-state`,
            `indeterminate`
        );
    });
});
