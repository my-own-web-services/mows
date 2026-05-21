import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe(`Switch`, () => {
    it(`renders unchecked by default`, () => {
        render(<Switch aria-label={`x`} />);
        const sw = screen.getByRole(`switch`, { name: `x` });
        expect(sw).toHaveAttribute(`data-state`, `unchecked`);
    });

    it(`reflects defaultChecked on first mount`, () => {
        render(<Switch aria-label={`x`} defaultChecked />);
        expect(screen.getByRole(`switch`, { name: `x` })).toHaveAttribute(
            `data-state`,
            `checked`
        );
    });

    it(`fires onCheckedChange on click (uncontrolled)`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Switch aria-label={`x`} onCheckedChange={onChange} />);
        await user.click(screen.getByRole(`switch`, { name: `x` }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it(`is fully controllable via checked + onCheckedChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState(false);
            return (
                <>
                    <Switch aria-label={`x`} checked={v} onCheckedChange={setV} />
                    <span data-testid={`v`}>{String(v)}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`v`)).toHaveTextContent(`false`);
        await user.click(screen.getByRole(`switch`, { name: `x` }));
        expect(screen.getByTestId(`v`)).toHaveTextContent(`true`);
    });

    it(`does not toggle when disabled`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Switch aria-label={`x`} disabled onCheckedChange={onChange} />);
        const sw = screen.getByRole(`switch`, { name: `x` });
        expect(sw).toBeDisabled();
        await user.click(sw);
        expect(onChange).not.toHaveBeenCalled();
    });

    it(`thumb translates only when checked`, () => {
        const { container, rerender } = render(<Switch aria-label={`x`} />);
        const thumb = container.querySelector(`[data-state]`)?.firstChild as HTMLElement | null;
        expect(thumb).not.toBeNull();
        expect(thumb!.className).toMatch(/data-\[state=checked\]:translate-x-4/);
        rerender(<Switch aria-label={`x`} checked />);
        // The translate-x class is applied conditionally by Radix via the data-state attr.
        const root = container.querySelector(`[role="switch"]`);
        expect(root).toHaveAttribute(`data-state`, `checked`);
    });
});
