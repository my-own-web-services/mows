import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe(`Input`, () => {
    it(`renders a text input by default`, () => {
        render(<Input aria-label={`x`} />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        expect(el.tagName).toBe(`INPUT`);
    });

    it(`forwards the type attribute (e.g. password)`, () => {
        const { container } = render(
            <Input type={`password`} placeholder={`pw`} />
        );
        const el = container.querySelector(`input`);
        expect(el).toHaveAttribute(`type`, `password`);
    });

    it(`fires onChange when the user types`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Input aria-label={`x`} onChange={onChange} />);
        await user.type(screen.getByRole(`textbox`, { name: `x` }), `hi`);
        expect(onChange).toHaveBeenCalled();
    });

    it(`is fully controllable via value + onChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState(``);
            return <Input aria-label={`x`} value={v} onChange={(e) => setV(e.target.value)} />;
        };
        render(<Controlled />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        await user.type(el, `abc`);
        expect(el).toHaveValue(`abc`);
    });

    it(`does not accept input when disabled`, async () => {
        const user = userEvent.setup();
        render(<Input aria-label={`x`} disabled defaultValue={``} />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        expect(el).toBeDisabled();
        await user.type(el, `nope`);
        expect(el).toHaveValue(``);
    });

    it(`forwards a ref to the underlying input element`, () => {
        const ref = { current: null as HTMLInputElement | null };
        render(<Input aria-label={`x`} ref={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it(`merges a custom className with the base classes`, () => {
        render(<Input aria-label={`x`} className={`my-cls`} />);
        const el = screen.getByRole(`textbox`, { name: `x` });
        expect(el.className).toMatch(/my-cls/);
        expect(el.className).toMatch(/rounded-md/);
    });
});
