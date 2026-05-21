import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const renderGroup = (props: React.ComponentProps<typeof RadioGroup> = {}) =>
    render(
        <RadioGroup {...props}>
            <Label className={`flex items-center gap-2`}>
                <RadioGroupItem value={`one`} /> One
            </Label>
            <Label className={`flex items-center gap-2`}>
                <RadioGroupItem value={`two`} /> Two
            </Label>
            <Label className={`flex items-center gap-2`}>
                <RadioGroupItem value={`three`} disabled /> Three
            </Label>
        </RadioGroup>
    );

describe(`RadioGroup`, () => {
    it(`renders each item as a radio`, () => {
        renderGroup();
        const radios = screen.getAllByRole(`radio`);
        expect(radios).toHaveLength(3);
    });

    it(`uses role="radiogroup" on the wrapper`, () => {
        renderGroup();
        expect(screen.getByRole(`radiogroup`)).toBeInTheDocument();
    });

    it(`reflects defaultValue on first mount`, () => {
        renderGroup({ defaultValue: `two` });
        const radios = screen.getAllByRole(`radio`);
        expect(radios[0]).toHaveAttribute(`data-state`, `unchecked`);
        expect(radios[1]).toHaveAttribute(`data-state`, `checked`);
        expect(radios[2]).toHaveAttribute(`data-state`, `unchecked`);
    });

    it(`fires onValueChange when an item is clicked`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderGroup({ onValueChange: onChange });
        await user.click(screen.getAllByRole(`radio`)[0]!);
        expect(onChange).toHaveBeenCalledWith(`one`);
    });

    it(`is fully controllable via value + onValueChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState(`one`);
            return (
                <>
                    <RadioGroup value={v} onValueChange={setV}>
                        <RadioGroupItem value={`one`} aria-label={`one`} />
                        <RadioGroupItem value={`two`} aria-label={`two`} />
                    </RadioGroup>
                    <span data-testid={`v`}>{v}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`v`)).toHaveTextContent(`one`);
        await user.click(screen.getByRole(`radio`, { name: `two` }));
        expect(screen.getByTestId(`v`)).toHaveTextContent(`two`);
    });

    it(`does not switch to a disabled item`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderGroup({ defaultValue: `one`, onValueChange: onChange });
        const radios = screen.getAllByRole(`radio`);
        await user.click(radios[2]!);
        expect(onChange).not.toHaveBeenCalled();
        expect(radios[2]).toHaveAttribute(`data-state`, `unchecked`);
    });
});
