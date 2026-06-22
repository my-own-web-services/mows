import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import IconBadge, { type IconBadgePosition } from "./IconBadge";

afterEach(() => {
    cleanup();
});

describe(`IconBadge`, () => {
    it(`renders both the primary icon and the badge sub-icon`, () => {
        render(
            <IconBadge
                icon={<span data-testid={`primary`}>P</span>}
                badge={<span data-testid={`secondary`}>S</span>}
            />
        );
        expect(screen.getByTestId(`primary`)).toBeInTheDocument();
        expect(screen.getByTestId(`secondary`)).toBeInTheDocument();
    });

    it(`applies a radial-gradient mask to the primary icon wrapper for a genuinely transparent cutout`, () => {
        render(<IconBadge icon={<span>i</span>} badge={<span>b</span>} />);
        const iconWrapper = screen.getByTestId(`icon-badge-icon`);
        expect(iconWrapper.style.maskImage).toMatch(/radial-gradient/);
        expect(iconWrapper.style.maskImage).toMatch(/transparent/);
    });

    it(`renders without a border or background fill on the visible badge wrapper`, () => {
        render(<IconBadge icon={<span>i</span>} badge={<span>b</span>} />);
        const badge = screen.getByTestId(`icon-badge-badge`);
        expect(badge.className).not.toMatch(/(^|\s)border($|\s)/);
        expect(badge.className).not.toMatch(/\bbg-/);
    });

    it(`sets the outer width and height from the size prop`, () => {
        const { container } = render(
            <IconBadge size={48} icon={<span>i</span>} badge={<span>b</span>} />
        );
        const root = container.querySelector(`.IconBadge`) as HTMLElement;
        expect(root.style.width).toBe(`48px`);
        expect(root.style.height).toBe(`48px`);
    });

    it(`derives the badge size from badgeFraction`, () => {
        render(
            <IconBadge
                size={48}
                badgeFraction={0.5}
                icon={<span>i</span>}
                badge={<span>b</span>}
            />
        );
        const badge = screen.getByTestId(`icon-badge-badge`);
        expect(badge.style.width).toBe(`24px`);
        expect(badge.style.height).toBe(`24px`);
    });

    it(`anchors the badge to bottom-right by default`, () => {
        const { container } = render(
            <IconBadge icon={<span>i</span>} badge={<span>b</span>} />
        );
        const root = container.querySelector(`.IconBadge`) as HTMLElement;
        expect(root.getAttribute(`data-position`)).toBe(`bottom-right`);
        const badge = screen.getByTestId(`icon-badge-badge`);
        expect(badge.style.right).toBe(`0px`);
        expect(badge.style.bottom).toBe(`0px`);
    });

    it.each([
        [`top-left`, { left: `0px`, top: `0px` }],
        [`top-right`, { right: `0px`, top: `0px` }],
        [`bottom-left`, { left: `0px`, bottom: `0px` }],
        [`bottom-right`, { right: `0px`, bottom: `0px` }]
    ] as const)(`anchors the badge to the %s corner`, (position, expected) => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                badgePosition={position as IconBadgePosition}
            />
        );
        const badge = screen.getByTestId(`icon-badge-badge`);
        for (const [prop, value] of Object.entries(expected)) {
            expect(badge.style.getPropertyValue(prop)).toBe(value);
        }
    });

    it.each([
        [`top`, `top`, `0px`, `left`],
        [`bottom`, `bottom`, `0px`, `left`],
        [`left`, `left`, `0px`, `top`],
        [`right`, `right`, `0px`, `top`]
    ] as const)(`anchors the badge to the %s edge midpoint with the matching side flush and the orthogonal axis centred`, (position, flushSide, flushValue, orthogonal) => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                badgePosition={position as IconBadgePosition}
                size={40}
                badgeFraction={0.5}
            />
        );
        const badge = screen.getByTestId(`icon-badge-badge`);
        expect(badge.style.getPropertyValue(flushSide)).toBe(flushValue);
        expect(badge.style.getPropertyValue(orthogonal)).toContain(`50%`);
    });

    it(`shifts the mask gradient center to the top-left corner`, () => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                badgePosition={`top-left`}
                size={40}
                badgeFraction={0.5}
            />
        );
        const wrapper = screen.getByTestId(`icon-badge-icon`);
        expect(wrapper.style.maskImage).toContain(`at 10px 10px`);
    });

    it(`shifts the mask gradient center to the top-edge midpoint`, () => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                badgePosition={`top`}
                size={40}
                badgeFraction={0.5}
            />
        );
        const wrapper = screen.getByTestId(`icon-badge-icon`);
        expect(wrapper.style.maskImage).toContain(`at 50% 10px`);
    });

    it(`forwards a custom badgeClassName to the visible badge container`, () => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                badgeClassName={`bg-destructive`}
            />
        );
        const badge = screen.getByTestId(`icon-badge-badge`);
        expect(badge.className).toContain(`bg-destructive`);
    });

    it(`grows the cut radius by badgeGap so the mask sits clearly outside the badge wrapper`, () => {
        render(
            <IconBadge
                icon={<span>i</span>}
                badge={<span>b</span>}
                size={40}
                badgeFraction={0.5}
                badgeGap={5}
            />
        );
        // halfBadge = 10, badgeGap = 5 → cutRadius = 15
        const wrapper = screen.getByTestId(`icon-badge-icon`);
        expect(wrapper.style.maskImage).toContain(`circle 15px`);
    });
});
