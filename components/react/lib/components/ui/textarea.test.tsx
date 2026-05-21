import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "./textarea";

describe(`Textarea`, () => {
    it(`renders a native textarea`, () => {
        const { container } = render(<Textarea aria-label={`x`} />);
        const el = container.querySelector(`textarea`);
        expect(el).not.toBeNull();
    });

    it(`fires onChange when the user types`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Textarea aria-label={`x`} onChange={onChange} />);
        await user.type(screen.getByRole(`textbox`, { name: `x` }), `hi`);
        expect(onChange).toHaveBeenCalled();
    });

    it(`is fully controllable via value + onChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState(``);
            return (
                <Textarea
                    aria-label={`x`}
                    value={v}
                    onChange={(e) => setV(e.target.value)}
                />
            );
        };
        render(<Controlled />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        await user.type(el, `multi\nline`);
        expect(el).toHaveValue(`multi\nline`);
    });

    it(`forwards a ref to the underlying textarea element`, () => {
        const ref = { current: null as HTMLTextAreaElement | null };
        render(<Textarea aria-label={`x`} ref={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it(`disabled prevents typing`, async () => {
        const user = userEvent.setup();
        render(<Textarea aria-label={`x`} disabled defaultValue={``} />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        expect(el).toBeDisabled();
        await user.type(el, `nope`);
        expect(el).toHaveValue(``);
    });

    it(`carries the min-height + rounded styling`, () => {
        render(<Textarea aria-label={`x`} />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        expect(el.className).toMatch(/min-h-\[60px\]/);
        expect(el.className).toMatch(/rounded-md/);
    });
});
