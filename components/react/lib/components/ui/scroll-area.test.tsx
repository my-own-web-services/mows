import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "./scroll-area";

describe(`ScrollArea`, () => {
    it(`renders the relative-positioned overflow-hidden shell`, () => {
        const { container } = render(<ScrollArea>body</ScrollArea>);
        const root = container.firstChild as HTMLElement;
        expect(root.className).toMatch(/relative/);
        expect(root.className).toMatch(/overflow-hidden/);
    });

    it(`renders the children inside a viewport with h-full / w-full`, () => {
        const { container, getByText } = render(<ScrollArea>my body</ScrollArea>);
        const body = getByText(`my body`);
        const viewport = body.closest(`[data-radix-scroll-area-viewport]`);
        expect(viewport).not.toBeNull();
        expect(viewport).toHaveTextContent(`my body`);
        expect(container.contains(viewport!)).toBe(true);
    });

    it(`forwards viewportRef to the inner viewport`, () => {
        const ref = { current: null as HTMLDivElement | null };
        render(<ScrollArea viewportRef={ref}>x</ScrollArea>);
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current?.getAttribute(`data-radix-scroll-area-viewport`)).toBe(``);
    });

    it(`merges viewportClassName onto the viewport`, () => {
        render(<ScrollArea viewportClassName={`my-vp`}>x</ScrollArea>);
        const viewport = document.querySelector(`[data-radix-scroll-area-viewport]`);
        expect(viewport?.className).toMatch(/my-vp/);
        expect(viewport?.className).toMatch(/h-full/);
    });

    // Radix only mounts the visible scrollbar/thumb when its viewport
    // actually overflows. jsdom has no layout engine, so the scrollbar DOM
    // is intentionally absent in the unit-test environment. The visible
    // scrollbar styling (vertical / horizontal width + height utilities)
    // is exercised in the matching doc-page example, not here.
});
