import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Compass from "./Compass";

describe(`Compass`, () => {
    it(`renders the default readout as integer degrees + cardinal direction`, () => {
        render(<Compass heading={0} />);
        expect(screen.getByText(/0°\s+N/)).toBeInTheDocument();
    });

    it(`normalises a negative heading into the 0-359° range`, () => {
        render(<Compass heading={-45} />);
        // -45° wraps to 315° (NW).
        expect(screen.getByText(/315°\s+NW/)).toBeInTheDocument();
    });

    it(`normalises a heading > 360°`, () => {
        render(<Compass heading={720 + 90} />);
        // 810° → 90° (E).
        expect(screen.getByText(/90°\s+E/)).toBeInTheDocument();
    });

    it(`maps headings near a cardinal to that cardinal direction`, () => {
        render(<Compass heading={92} />);
        expect(screen.getByText(/92°\s+E/)).toBeInTheDocument();
    });

    it(`renders cardinal labels (N / E / S / W) by default`, () => {
        const { container } = render(<Compass heading={0} />);
        // The centred cardinal (N at 0°) appears in the bar. Use container
        // query rather than getByText because the readout also contains "N".
        const bar = container.querySelector(`.Compass`);
        expect(bar?.textContent).toMatch(/N/);
    });

    it(`hides the readout when readout={null}`, () => {
        const { container } = render(<Compass heading={42} readout={null} />);
        const bar = container.querySelector(`.Compass`);
        // The bar still renders but no readout line below it.
        expect(bar?.textContent).not.toMatch(/42°/);
    });

    it(`accepts a custom readout node`, () => {
        render(<Compass heading={0} readout={<span>custom readout</span>} />);
        expect(screen.getByText(`custom readout`)).toBeInTheDocument();
    });

    it(`renders extra markers passed via the markers prop`, () => {
        render(
            <Compass
                heading={0}
                markers={[{ bearing: 30, label: `Goal` }]}
            />
        );
        expect(screen.getByText(`Goal`)).toBeInTheDocument();
    });

    it(`hideCardinals removes the default cardinal labels from the bar`, () => {
        const { container } = render(
            <Compass
                heading={0}
                hideCardinals
                markers={[{ bearing: 30, label: `Goal` }]}
            />
        );
        // The marker is still rendered.
        expect(screen.getByText(`Goal`)).toBeInTheDocument();
        // The bar has no extra cardinal labels — only the readout below
        // mentions "N".
        const bar = container.querySelector(`.bg-card`);
        expect(bar?.textContent).not.toMatch(/\bN\b/);
        expect(bar?.textContent).not.toMatch(/\bE\b/);
    });
});
