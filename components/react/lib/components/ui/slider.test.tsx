import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Slider } from "./slider";

describe(`Slider`, () => {
    it(`renders a single thumb by default`, () => {
        render(<Slider />);
        const thumbs = screen.getAllByRole(`slider`);
        expect(thumbs).toHaveLength(1);
    });

    it(`renders one thumb per entry in defaultValue`, () => {
        render(<Slider defaultValue={[20, 80]} />);
        expect(screen.getAllByRole(`slider`)).toHaveLength(2);
    });

    it(`renders one thumb per entry in controlled value`, () => {
        render(<Slider value={[10, 40, 70]} onValueChange={() => undefined} />);
        expect(screen.getAllByRole(`slider`)).toHaveLength(3);
    });

    it(`forwards min / max to the underlying slider`, () => {
        render(<Slider min={50} max={200} defaultValue={[120]} />);
        const thumb = screen.getByRole(`slider`);
        expect(thumb).toHaveAttribute(`aria-valuemin`, `50`);
        expect(thumb).toHaveAttribute(`aria-valuemax`, `200`);
        expect(thumb).toHaveAttribute(`aria-valuenow`, `120`);
    });

    it(`uses 0-100 as the default range`, () => {
        render(<Slider defaultValue={[10]} />);
        const thumb = screen.getByRole(`slider`);
        expect(thumb).toHaveAttribute(`aria-valuemin`, `0`);
        expect(thumb).toHaveAttribute(`aria-valuemax`, `100`);
    });

    it(`disabled forwards onto the thumbs`, () => {
        render(<Slider disabled defaultValue={[10, 90]} />);
        const thumbs = screen.getAllByRole(`slider`);
        for (const t of thumbs) expect(t).toHaveAttribute(`data-disabled`);
    });

    it(`merges a custom className with the base classes`, () => {
        const { container } = render(<Slider className={`my-cls`} />);
        const root = container.firstChild as HTMLElement;
        expect(root.className).toMatch(/my-cls/);
        expect(root.className).toMatch(/relative/);
    });
});
