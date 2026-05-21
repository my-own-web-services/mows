import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe(`Button`, () => {
    it(`renders a native button element by default`, () => {
        render(<Button>click me</Button>);
        const btn = screen.getByRole(`button`, { name: `click me` });
        expect(btn.tagName).toBe(`BUTTON`);
    });

    it(`applies the default variant + size when none is provided`, () => {
        render(<Button>default</Button>);
        const btn = screen.getByRole(`button`, { name: `default` });
        expect(btn.className).toMatch(/bg-primary/);
        expect(btn.className).toMatch(/h-9/);
    });

    it.each([
        [`destructive`, /bg-destructive/],
        [`outline`, /border-input/],
        [`secondary`, /bg-secondary/],
        [`ghost`, /hover:bg-accent/],
        [`link`, /underline-offset-4/],
        [`iconStandalone`, /bg-transparent/]
    ] as const)(`applies %s variant classes`, (variant, expected) => {
        render(<Button variant={variant}>{variant}</Button>);
        const btn = screen.getByRole(`button`, { name: variant });
        expect(btn.className).toMatch(expected);
    });

    it.each([
        [`sm`, /h-8/],
        [`lg`, /h-10/],
        [`icon`, /h-9 w-9/],
        [`icon-sm`, /size-8/],
        [`icon-lg`, /size-10/],
        [`icon-xs`, /size-5/]
    ] as const)(`applies %s size classes`, (size, expected) => {
        render(<Button size={size}>x</Button>);
        const btn = screen.getByRole(`button`, { name: `x` });
        expect(btn.className).toMatch(expected);
    });

    it(`fires onClick when clicked`, async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button onClick={onClick}>fire</Button>);
        await user.click(screen.getByRole(`button`, { name: `fire` }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it(`does not fire onClick when disabled`, async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <Button onClick={onClick} disabled>
                no
            </Button>
        );
        await user.click(screen.getByRole(`button`, { name: `no` }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it(`asChild renders the child element instead of a native button`, () => {
        render(
            <Button asChild>
                <a href={`#target`}>link</a>
            </Button>
        );
        const link = screen.getByRole(`link`, { name: `link` });
        expect(link.tagName).toBe(`A`);
        expect(link.className).toMatch(/bg-primary/);
    });
});
