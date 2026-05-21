import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

const getIndicator = (root: HTMLElement): HTMLElement => {
    const indicator = root.querySelector(`[data-state]`);
    if (!indicator) throw new Error(`progress indicator not found`);
    return indicator as HTMLElement;
};

describe(`Progress`, () => {
    it(`renders the track with a relative-positioned overflow-hidden shell`, () => {
        const { container } = render(<Progress value={0} />);
        const root = container.firstChild as HTMLElement;
        expect(root.className).toMatch(/relative/);
        expect(root.className).toMatch(/overflow-hidden/);
        expect(root.className).toMatch(/rounded-full/);
    });

    it(`translates the indicator by -100% at value=0`, () => {
        const { container } = render(<Progress value={0} />);
        const indicator = getIndicator(container.firstChild as HTMLElement);
        expect(indicator.style.transform).toBe(`translateX(-100%)`);
    });

    it(`translates the indicator by -50% at value=50`, () => {
        const { container } = render(<Progress value={50} />);
        const indicator = getIndicator(container.firstChild as HTMLElement);
        expect(indicator.style.transform).toBe(`translateX(-50%)`);
    });

    it(`translates the indicator by 0 at value=100`, () => {
        const { container } = render(<Progress value={100} />);
        const indicator = getIndicator(container.firstChild as HTMLElement);
        expect(indicator.style.transform).toBe(`translateX(-0%)`);
    });

    it(`treats an omitted value as 0`, () => {
        const { container } = render(<Progress />);
        const indicator = getIndicator(container.firstChild as HTMLElement);
        expect(indicator.style.transform).toBe(`translateX(-100%)`);
    });

    it(`merges a custom className with the base classes`, () => {
        const { container } = render(<Progress value={25} className={`my-cls`} />);
        const root = container.firstChild as HTMLElement;
        expect(root.className).toMatch(/my-cls/);
        expect(root.className).toMatch(/rounded-full/);
    });
});
