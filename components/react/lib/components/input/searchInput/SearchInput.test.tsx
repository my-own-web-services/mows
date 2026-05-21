import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SearchInput from "./SearchInput";

const Controlled = ({
    initial = ``,
    ...rest
}: { initial?: string } & Omit<React.ComponentProps<typeof SearchInput>, `value` | `onValueChange`>) => {
    const [v, setV] = useState(initial);
    return <SearchInput value={v} onValueChange={setV} {...rest} />;
};

describe(`SearchInput`, () => {
    it(`renders a type="search" input`, () => {
        render(<Controlled aria-label={`x`} />);
        const input = screen.getByRole(`searchbox`, { name: `x` });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute(`type`, `search`);
    });

    it(`renders the leading search icon by default`, () => {
        const { container } = render(<Controlled aria-label={`x`} />);
        // The leading addon contains a Lucide Search svg.
        const svg = container.querySelector(`svg`);
        expect(svg).not.toBeNull();
    });

    it(`hideIcon removes the leading addon`, () => {
        const { container } = render(<Controlled aria-label={`x`} hideIcon />);
        // No SVG should render when both hideIcon and no value (no clear).
        expect(container.querySelectorAll(`svg`).length).toBe(0);
    });

    it(`fires onValueChange when the user types`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<SearchInput value={``} onValueChange={onChange} aria-label={`x`} />);
        await user.type(screen.getByRole(`searchbox`, { name: `x` }), `a`);
        expect(onChange).toHaveBeenCalledWith(`a`);
    });

    it(`shows the clear button once the value is non-empty`, () => {
        render(<Controlled initial={`hi`} aria-label={`x`} clearAriaLabel={`Clear`} />);
        expect(screen.getByRole(`button`, { name: `Clear` })).toBeInTheDocument();
    });

    it(`clicking the clear button resets the value to ""`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <SearchInput
                value={`hi`}
                onValueChange={onChange}
                aria-label={`x`}
                clearAriaLabel={`Clear`}
            />
        );
        await user.click(screen.getByRole(`button`, { name: `Clear` }));
        expect(onChange).toHaveBeenCalledWith(``);
    });

    it(`hideClearButton suppresses the clear button even when non-empty`, () => {
        render(
            <Controlled
                initial={`hi`}
                aria-label={`x`}
                clearAriaLabel={`Clear`}
                hideClearButton
            />
        );
        expect(screen.queryByRole(`button`, { name: `Clear` })).toBeNull();
    });

    it(`disabled forwards onto the input and clear button`, () => {
        render(
            <Controlled
                initial={`hi`}
                aria-label={`x`}
                clearAriaLabel={`Clear`}
                disabled
            />
        );
        expect(screen.getByRole(`searchbox`, { name: `x` })).toBeDisabled();
        expect(screen.getByRole(`button`, { name: `Clear` })).toBeDisabled();
    });
});
