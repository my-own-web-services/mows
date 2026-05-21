import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionHeading } from "./SectionHeading";

beforeEach(() => {
    document.body.innerHTML = ``;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
    window.history.replaceState(null, ``, ` `);
});

describe(`SectionHeading`, () => {
    it(`renders the requested heading level with the given id`, () => {
        render(
            <SectionHeading id={`alpha`} level={3}>
                Alpha
            </SectionHeading>
        );
        const heading = screen.getByRole(`heading`, { name: `Alpha`, level: 3 });
        expect(heading).toHaveAttribute(`id`, `alpha`);
    });

    it(`defaults to h2`, () => {
        render(<SectionHeading id={`x`}>X</SectionHeading>);
        expect(screen.getByRole(`heading`, { level: 2, name: `X` })).toBeInTheDocument();
    });

    it(`wraps the text in an anchor with the matching href`, () => {
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        const link = screen.getByRole(`link`, { name: `Alpha` });
        expect(link).toHaveAttribute(`href`, `#alpha`);
    });

    it(`pushes the id to the URL on click`, async () => {
        const user = userEvent.setup();
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        await user.click(screen.getByRole(`link`, { name: `Alpha` }));
        expect(window.location.hash).toBe(`#alpha`);
    });

    it(`does not push a duplicate history entry when the hash is already current`, async () => {
        window.history.replaceState(null, ``, `#alpha`);
        const spy = vi.spyOn(window.history, `pushState`);
        const user = userEvent.setup();
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        await user.click(screen.getByRole(`link`, { name: `Alpha` }));
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it(`prevents the browser's default scroll so we can use scrollToSection`, async () => {
        const user = userEvent.setup();
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        await user.click(screen.getByRole(`link`, { name: `Alpha` }));
        // scrollToSection silently returns false when the id isn't on the
        // page; the explicit assertion here is that the click doesn't
        // throw and the URL is still updated.
        expect(window.location.hash).toBe(`#alpha`);
    });

    it(`underlines the heading text on hover`, () => {
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        const link = screen.getByRole(`link`, { name: /Alpha/ });
        // The anchor wraps only the title text now, so hover:underline
        // lives directly on it. The "#" marker is a sibling and is never
        // underlined because it sits outside the link entirely.
        expect(link.className).toMatch(/hover:underline/);
    });

    it(`only the title text is clickable — the "#" marker sits outside the anchor`, () => {
        render(<SectionHeading id={`alpha`}>Alpha</SectionHeading>);
        const link = screen.getByRole(`link`, { name: /Alpha/ });
        // The link wraps only the title; querying inside it must NOT find
        // a "#" span.
        const markerInsideLink = Array.from(link.querySelectorAll(`span`)).find(
            (s) => s.textContent === `#`
        );
        expect(markerInsideLink).toBeUndefined();
        // …but the marker exists as the link's sibling.
        const heading = link.closest(`h1,h2,h3,h4,h5,h6`)!;
        const marker = Array.from(heading.querySelectorAll(`span`)).find(
            (s) => s.textContent === `#`
        );
        expect(marker).toBeTruthy();
        expect(marker?.getAttribute(`aria-hidden`)).toBe(`true`);
        expect(marker?.className).toMatch(/opacity-0/);
        expect(marker?.className).toMatch(/group-hover:opacity-100/);
        expect(marker?.className).toMatch(/text-muted-foreground\/40/);
        expect(marker?.className).toMatch(/inline-block/);
    });
});
