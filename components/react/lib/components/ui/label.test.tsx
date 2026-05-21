import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Label } from "./label";

describe(`Label`, () => {
    it(`renders a native label element`, () => {
        const { container } = render(<Label>my label</Label>);
        const el = container.querySelector(`label`);
        expect(el).not.toBeNull();
        expect(el).toHaveTextContent(`my label`);
    });

    it(`carries the heading typography classes`, () => {
        render(<Label>x</Label>);
        const el = screen.getByText(`x`);
        expect(el.className).toMatch(/text-sm/);
        expect(el.className).toMatch(/font-medium/);
    });

    it(`forwards htmlFor and focuses the matched input on click`, async () => {
        const user = userEvent.setup();
        render(
            <>
                <Label htmlFor={`my-input`}>label</Label>
                <Input id={`my-input`} aria-label={`x`} />
            </>
        );
        await user.click(screen.getByText(`label`));
        expect(screen.getByRole(`textbox`, { name: `x` })).toHaveFocus();
    });

    it(`merges a custom className with the base classes`, () => {
        render(<Label className={`my-cls`}>x</Label>);
        const el = screen.getByText(`x`);
        expect(el.className).toMatch(/my-cls/);
        expect(el.className).toMatch(/font-medium/);
    });
});
