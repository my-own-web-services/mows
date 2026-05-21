import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageIndex } from "./PageIndex";

const setupDom = () => {
    document.body.innerHTML = `
        <div>
            <section id="alpha" style="height:600px">alpha</section>
            <section id="beta" style="height:600px">beta</section>
            <section id="gamma" style="height:600px">gamma</section>
        </div>
    `;
    // jsdom doesn't implement smooth scrolling — stub it.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
};

const items = [
    { id: `alpha`, label: `Alpha` },
    { id: `beta`, label: `Beta` },
    { id: `gamma`, label: `Gamma` }
];

describe(`PageIndex`, () => {
    beforeEach(setupDom);
    afterEach(() => {
        document.body.innerHTML = ``;
        window.history.replaceState(null, ``, ` `);
    });

    it(`renders one link per item with the matching href`, () => {
        render(<PageIndex items={items} />);
        const links = screen.getAllByRole(`link`);
        expect(links).toHaveLength(3);
        expect(links[0]).toHaveAttribute(`href`, `#alpha`);
        expect(links[1]).toHaveAttribute(`href`, `#beta`);
        expect(links[2]).toHaveAttribute(`href`, `#gamma`);
    });

    it(`scrolls to the section and writes the URL hash on click`, async () => {
        const user = userEvent.setup();
        render(<PageIndex items={items} />);
        await user.click(screen.getByRole(`link`, { name: `Beta` }));
        expect(window.scrollTo).toHaveBeenCalled();
        expect(window.location.hash).toBe(`#beta`);
    });

    it(`animates the scroll on click ("smooth")`, async () => {
        const user = userEvent.setup();
        render(<PageIndex items={items} />);
        await user.click(screen.getByRole(`link`, { name: `Beta` }));
        const call = (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock
            .calls[0]?.[0] as ScrollToOptions | undefined;
        expect(call?.behavior).toBe(`smooth`);
    });

    it(`jumps instantly (no animation) when a hash is present at mount`, async () => {
        window.history.replaceState(null, ``, `#beta`);
        render(<PageIndex items={items} />);
        // The hash effect schedules an rAF; flush it.
        await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
        );
        const scrollMock = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
        expect(scrollMock).toHaveBeenCalled();
        const opts = scrollMock.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
        expect(opts?.behavior).toBe(`auto`);
    });

    it(`marks the clicked entry active immediately, even when the page does not actually scroll`, async () => {
        const user = userEvent.setup();
        render(<PageIndex items={items} />);

        const betaLink = screen.getByRole(`link`, { name: `Beta` });
        expect(betaLink).not.toHaveAttribute(`aria-current`);

        await user.click(betaLink);

        // jsdom never fires real scroll events for window.scrollTo(...), so
        // without the explicit lockTo on click the scrollspy wouldn't
        // update and beta would stay un-highlighted. This guards against
        // that regression.
        expect(betaLink).toHaveAttribute(`aria-current`, `location`);
    });

    it(`holds the clicked entry active while scroll events fire mid-animation`, async () => {
        const user = userEvent.setup();
        render(<PageIndex items={items} />);

        await user.click(screen.getByRole(`link`, { name: `Gamma` }));
        expect(screen.getByRole(`link`, { name: `Gamma` })).toHaveAttribute(
            `aria-current`,
            `location`
        );

        // Smooth-scroll animation would emit scroll events at intermediate
        // positions where the scrollspy's natural compute picks an earlier
        // section. Simulate that. The lock must keep gamma highlighted
        // until the scrollspy actually agrees (i.e., the page has landed).
        window.dispatchEvent(new Event(`scroll`));
        window.dispatchEvent(new Event(`scroll`));

        expect(screen.getByRole(`link`, { name: `Gamma` })).toHaveAttribute(
            `aria-current`,
            `location`
        );
        expect(screen.getByRole(`link`, { name: `Alpha` })).not.toHaveAttribute(
            `aria-current`
        );
    });

    it(`marks the first item active when the page is at the top`, () => {
        render(<PageIndex items={items} />);
        expect(
            screen.getByRole(`link`, { name: `Alpha` })
        ).toHaveAttribute(`aria-current`, `location`);
    });

    it(`renders nothing when items is empty`, () => {
        const { container } = render(<PageIndex items={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it(`skips the hash write when the target id is missing`, async () => {
        const user = userEvent.setup();
        render(
            <PageIndex
                items={[{ id: `missing`, label: `Missing` }, ...items]}
            />
        );
        await user.click(screen.getByRole(`link`, { name: `Missing` }));
        expect(window.location.hash).toBe(``);
    });

    it(`falls back to English when no MowsContext is mounted`, () => {
        render(<PageIndex items={items} />);
        expect(screen.getByText(`On this page`)).toBeInTheDocument();
        expect(
            screen.getByRole(`navigation`, { name: `On this page` })
        ).toBeInTheDocument();
    });

    it(`honours explicit heading + ariaLabel props`, () => {
        render(
            <PageIndex
                items={items}
                heading={`Sections`}
                ariaLabel={`Section navigation`}
            />
        );
        expect(screen.getByText(`Sections`)).toBeInTheDocument();
        expect(
            screen.getByRole(`navigation`, { name: `Section navigation` })
        ).toBeInTheDocument();
    });

    it(`hides the heading when heading={null}`, () => {
        render(<PageIndex items={items} heading={null} />);
        expect(screen.queryByText(`On this page`)).not.toBeInTheDocument();
    });

    describe(`nesting`, () => {
        const setupNestedDom = () => {
            document.body.innerHTML = `
                <div>
                    <section id="install" style="height:600px">install</section>
                    <section id="examples" style="height:200px">examples</section>
                    <section id="ex-line" style="height:600px">line</section>
                    <section id="ex-vertical" style="height:600px">vertical</section>
                    <section id="api" style="height:600px">api</section>
                </div>
            `;
            window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
        };

        const nested = [
            { id: `install`, label: `Installation` },
            {
                id: `examples`,
                label: `Examples`,
                children: [
                    { id: `ex-line`, label: `Line` },
                    { id: `ex-vertical`, label: `Vertical` }
                ]
            },
            { id: `api`, label: `API Reference` }
        ];

        it(`renders a link for every leaf and parent`, () => {
            setupNestedDom();
            render(<PageIndex items={nested} />);
            for (const name of [`Installation`, `Examples`, `Line`, `Vertical`, `API Reference`]) {
                expect(screen.getByRole(`link`, { name })).toBeInTheDocument();
            }
        });

        it(`scrolls to nested children when clicked`, async () => {
            setupNestedDom();
            const user = userEvent.setup();
            render(<PageIndex items={nested} />);
            await user.click(screen.getByRole(`link`, { name: `Line` }));
            expect(window.scrollTo).toHaveBeenCalled();
            expect(window.location.hash).toBe(`#ex-line`);
        });

        it(`indents nested entries more than their parent`, () => {
            setupNestedDom();
            render(<PageIndex items={nested} />);
            const parent = screen.getByRole(`link`, { name: `Examples` });
            const child = screen.getByRole(`link`, { name: `Line` });
            const parentPad = parseFloat(parent.style.paddingLeft);
            const childPad = parseFloat(child.style.paddingLeft);
            expect(childPad).toBeGreaterThan(parentPad);
        });

        it(`keeps the active-line indicator pinned to the leftmost edge regardless of depth`, () => {
            // Regression: previously the nested <ul> was wrapped in an
            // ml-3 div, which shifted the per-anchor border-l (which is what
            // becomes the active highlight) to the right by one indent step
            // per depth level. The trunk must stay at x=0 for every link.
            setupNestedDom();
            const { container } = render(<PageIndex items={nested} />);
            const links = container.querySelectorAll<HTMLAnchorElement>(`a`);
            const lefts = Array.from(links).map((a) => a.getBoundingClientRect().left);
            const first = lefts[0];
            for (const left of lefts) {
                expect(left).toBeCloseTo(first, 0);
            }
        });
    });
});
