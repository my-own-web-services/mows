import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Step, Steps } from "./steps";

const renderSteps = (current = 1, orientation: `horizontal` | `vertical` = `horizontal`) =>
    render(
        <Steps current={current} orientation={orientation}>
            <Step title={`One`} description={`First step`} />
            <Step title={`Two`} />
            <Step title={`Three`} />
        </Steps>
    );

describe(`Steps`, () => {
    it(`derives completed / current / upcoming from current index`, () => {
        renderSteps(1);
        const items = screen.getAllByRole(`listitem`);
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveAttribute(`data-status`, `completed`);
        expect(items[1]).toHaveAttribute(`data-status`, `current`);
        expect(items[2]).toHaveAttribute(`data-status`, `upcoming`);
    });

    it(`marks the current step with aria-current`, () => {
        renderSteps(1);
        const items = screen.getAllByRole(`listitem`);
        expect(items[1]).toHaveAttribute(`aria-current`, `step`);
        expect(items[0]).not.toHaveAttribute(`aria-current`);
        expect(items[2]).not.toHaveAttribute(`aria-current`);
    });

    it(`renders titles and descriptions`, () => {
        renderSteps();
        expect(screen.getByText(`One`)).toBeInTheDocument();
        expect(screen.getByText(`First step`)).toBeInTheDocument();
        expect(screen.getByText(`Two`)).toBeInTheDocument();
        expect(screen.getByText(`Three`)).toBeInTheDocument();
    });

    it(`reflects orientation on the list and respects it for layout`, () => {
        const { rerender } = renderSteps(0, `horizontal`);
        const horizontalList = screen.getByRole(`list`);
        expect(horizontalList).toHaveAttribute(`data-orientation`, `horizontal`);
        expect(horizontalList).toHaveAttribute(`aria-orientation`, `horizontal`);

        rerender(
            <Steps current={0} orientation={`vertical`}>
                <Step title={`One`} />
                <Step title={`Two`} />
            </Steps>
        );
        const verticalList = screen.getByRole(`list`);
        expect(verticalList).toHaveAttribute(`data-orientation`, `vertical`);
        expect(verticalList).toHaveAttribute(`aria-orientation`, `vertical`);
    });

    it(`allows per-step status override`, () => {
        render(
            <Steps current={0}>
                <Step title={`One`} />
                <Step title={`Two`} status={`completed`} />
                <Step title={`Three`} status={`current`} />
            </Steps>
        );
        const items = screen.getAllByRole(`listitem`);
        expect(items[0]).toHaveAttribute(`data-status`, `current`);
        expect(items[1]).toHaveAttribute(`data-status`, `completed`);
        expect(items[2]).toHaveAttribute(`data-status`, `current`);
    });

    it(`selection mode never marks earlier steps as completed`, () => {
        render(
            <Steps current={1} mode={`selection`}>
                <Step title={`One`} />
                <Step title={`Two`} />
                <Step title={`Three`} />
            </Steps>
        );
        const items = screen.getAllByRole(`listitem`);
        // index 0 is "before" current — would be "completed" in progress mode,
        // but in selection mode it must stay non-completed.
        expect(items[0]).toHaveAttribute(`data-status`, `upcoming`);
        expect(items[1]).toHaveAttribute(`data-status`, `current`);
        expect(items[2]).toHaveAttribute(`data-status`, `upcoming`);
    });

    it(`selection mode shows the step number on every step (no check icons)`, () => {
        const { container } = render(
            <Steps current={1} mode={`selection`}>
                <Step title={`One`} />
                <Step title={`Two`} />
                <Step title={`Three`} />
            </Steps>
        );
        // Numbers visible inside the indicators.
        const indicators = container.querySelectorAll(`span[data-status]`);
        const numberTexts = Array.from(indicators)
            .filter((el) => /^[123]$/.test(el.textContent?.trim() ?? ``))
            .map((el) => el.textContent?.trim());
        expect(numberTexts).toEqual([`1`, `2`, `3`]);
        // No SVGs in indicators — lucide Check renders as <svg>.
        expect(container.querySelector(`span[data-status] svg`)).toBeNull();
    });

    it(`horizontal: first step left-aligned, middle centered, last right-aligned`, () => {
        const { container } = renderSteps(0, `horizontal`);
        const items = screen.getAllByRole(`listitem`);
        // The label container is the second child of each <li>: indicator-row, then label-row.
        const labelRow = (li: Element) => li.children[1] as HTMLElement;
        expect(labelRow(items[0]!).className).toMatch(/items-start/);
        expect(labelRow(items[0]!).className).toMatch(/text-left/);
        expect(labelRow(items[1]!).className).toMatch(/items-center/);
        expect(labelRow(items[1]!).className).toMatch(/text-center/);
        expect(labelRow(items[2]!).className).toMatch(/items-end/);
        expect(labelRow(items[2]!).className).toMatch(/text-right/);
        // Sanity: middle step gets a connector both before and after the dot.
        const middle = items[1]!;
        expect(middle.querySelector(`[data-connector="before"]`)).not.toBeNull();
        expect(middle.querySelector(`[data-connector="after"]`)).not.toBeNull();
        // First step: only after-connector. Last step: only before-connector.
        expect(items[0]!.querySelector(`[data-connector="before"]`)).toBeNull();
        expect(items[0]!.querySelector(`[data-connector="after"]`)).not.toBeNull();
        expect(items[2]!.querySelector(`[data-connector="before"]`)).not.toBeNull();
        expect(items[2]!.querySelector(`[data-connector="after"]`)).toBeNull();
        // The unused `container` variable would be unused otherwise — assert ol exists too.
        expect(container.querySelector(`ol`)).not.toBeNull();
    });

    it(`vertical layout is unaffected by the horizontal alignment rules`, () => {
        renderSteps(0, `vertical`);
        const items = screen.getAllByRole(`listitem`);
        // No horizontal alignment classes injected on any label in vertical mode.
        for (const li of items) {
            expect(li.className).not.toMatch(/text-right/);
            expect(li.className).not.toMatch(/items-end/);
        }
    });

    it(`throws when <Step> is rendered outside <Steps>`, () => {
        const spy = vi.spyOn(console, `error`).mockImplementation(() => undefined);
        expect(() => render(<Step title={`Orphan`} />)).toThrow(
            /must be rendered inside <Steps>/
        );
        spy.mockRestore();
    });
});
