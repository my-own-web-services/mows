import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyValueButton from "./CopyValueButton";

describe(`CopyValueButton`, () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, `clipboard`, {
            configurable: true,
            value: { writeText }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it(`renders the label when one is provided`, () => {
        render(<CopyValueButton value={`hello`} label={`Copy hello`} />);
        expect(screen.getByText(`Copy hello`)).toBeInTheDocument();
    });

    it(`omits the label when none is provided`, () => {
        const { container } = render(<CopyValueButton value={`hello`} />);
        expect(container.querySelector(`span`)).toBeNull();
    });

    it(`writes the value to the clipboard on click`, async () => {
        const { container } = render(<CopyValueButton value={`hello`} label={`Copy`} />);
        const root = container.querySelector(`.CopyValueButton`) as HTMLElement;
        root.click();
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(`hello`));
    });

    it(`shows the copied title for ~1.5s after a copy`, async () => {
        vi.useFakeTimers();
        const { container } = render(
            <CopyValueButton value={`hello`} label={`Copy`} title={`Click to copy`} />
        );
        const root = container.querySelector(`.CopyValueButton`) as HTMLElement;

        expect(root).toHaveAttribute(`title`, `Click to copy`);

        root.click();
        await vi.waitFor(() => expect(root).toHaveAttribute(`title`, `Copied!`));

        vi.advanceTimersByTime(1500);
        await vi.waitFor(() => expect(root).toHaveAttribute(`title`, `Click to copy`));
    });
});
