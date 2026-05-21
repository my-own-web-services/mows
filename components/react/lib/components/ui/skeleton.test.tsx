import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe(`Skeleton`, () => {
    it(`renders a div with the animate-pulse + rounded base classes`, () => {
        const { container } = render(<Skeleton data-testid={`s`} />);
        const el = container.firstChild as HTMLElement;
        expect(el.tagName).toBe(`DIV`);
        expect(el.className).toMatch(/animate-pulse/);
        expect(el.className).toMatch(/rounded-md/);
        expect(el.className).toMatch(/bg-primary\/10/);
    });

    it(`forwards an extra className`, () => {
        const { container } = render(<Skeleton className={`h-12 w-32`} />);
        const el = container.firstChild as HTMLElement;
        expect(el.className).toMatch(/h-12/);
        expect(el.className).toMatch(/w-32/);
        expect(el.className).toMatch(/animate-pulse/);
    });

    it(`forwards arbitrary HTML attributes`, () => {
        const { container } = render(<Skeleton id={`my-skel`} data-testid={`s`} />);
        const el = container.firstChild as HTMLElement;
        expect(el).toHaveAttribute(`id`, `my-skel`);
        expect(el).toHaveAttribute(`data-testid`, `s`);
    });
});
