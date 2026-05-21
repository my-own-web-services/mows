import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import NumberInput from "./NumberInput";

const Controlled = ({
    initial = null,
    ...rest
}: { initial?: number | null } & Omit<React.ComponentProps<typeof NumberInput>, `value` | `onChange`>) => {
    const [v, setV] = useState<number | null>(initial);
    return <NumberInput value={v} onChange={setV} {...rest} />;
};

describe(`NumberInput`, () => {
    it(`renders an input with the controlled value`, () => {
        render(<NumberInput value={42} onChange={() => undefined} ariaLabel={`x`} />);
        expect(screen.getByRole(`textbox`, { name: `x` })).toHaveValue(`42`);
    });

    it(`renders empty when value is null`, () => {
        render(<NumberInput value={null} onChange={() => undefined} ariaLabel={`x`} />);
        expect(screen.getByRole(`textbox`, { name: `x` })).toHaveValue(``);
    });

    it(`fires onChange with null when the user clears the field`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<NumberInput value={42} onChange={onChange} ariaLabel={`x`} />);
        const input = screen.getByRole(`textbox`, { name: `x` });
        await user.clear(input);
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it(`bumps by step when the + button is clicked`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<NumberInput value={5} onChange={onChange} step={2} ariaLabel={`x`} />);
        const buttons = screen.getAllByRole(`button`, { hidden: true });
        await user.click(buttons[1]!); // second button = "+"
        expect(onChange).toHaveBeenCalledWith(7);
    });

    it(`bumps by -step when the − button is clicked`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<NumberInput value={5} onChange={onChange} step={2} ariaLabel={`x`} />);
        const buttons = screen.getAllByRole(`button`, { hidden: true });
        await user.click(buttons[0]!);
        expect(onChange).toHaveBeenCalledWith(3);
    });

    it(`clamps to min on −`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<NumberInput value={3} onChange={onChange} min={0} step={5} ariaLabel={`x`} />);
        const buttons = screen.getAllByRole(`button`, { hidden: true });
        await user.click(buttons[0]!);
        expect(onChange).toHaveBeenCalledWith(0);
    });

    it(`clamps to max on +`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<NumberInput value={8} onChange={onChange} max={10} step={5} ariaLabel={`x`} />);
        const buttons = screen.getAllByRole(`button`, { hidden: true });
        await user.click(buttons[1]!);
        expect(onChange).toHaveBeenCalledWith(10);
    });

    it(`clamps an out-of-range typed value on blur`, async () => {
        const user = userEvent.setup();
        const Wrapper = () => {
            const [v, setV] = useState<number | null>(5);
            return (
                <NumberInput
                    value={v}
                    onChange={setV}
                    min={0}
                    max={10}
                    ariaLabel={`x`}
                />
            );
        };
        render(<Wrapper />);
        const input = screen.getByRole(`textbox`, { name: `x` }) as HTMLInputElement;
        await user.clear(input);
        await user.type(input, `999`);
        await user.tab();
        // After blur the controlled value is clamped to max=10; the input
        // reflects the parent state.
        expect(input.value).toBe(`10`);
    });

    it(`hideStepper drops the +/- buttons`, () => {
        render(<Controlled ariaLabel={`x`} hideStepper />);
        const buttons = screen.queryAllByRole(`button`, { hidden: true });
        expect(buttons.length).toBe(0);
    });
});
