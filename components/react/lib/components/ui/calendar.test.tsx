import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";

const NOV_2026 = new Date(2026, 10, 15);

describe(`Calendar`, () => {
    it(`renders a grid of day cells for the visible month`, () => {
        render(<Calendar month={NOV_2026} />);
        // react-day-picker uses role="gridcell" for each day in the grid.
        const cells = screen.getAllByRole(`gridcell`);
        expect(cells.length).toBeGreaterThan(20);
    });

    it(`marks the selected day on the cell or button via data-selected* attributes`, () => {
        const sel = new Date(2026, 10, 7);
        render(<Calendar month={NOV_2026} mode={`single`} selected={sel} />);
        const day = screen.getByRole(`button`, { name: /Saturday, November 7/i });
        // react-day-picker exposes selection via attributes on either the
        // day button or the wrapping gridcell. Look for any indication of
        // selection: data-selected, data-selected-single, or aria-selected.
        const cell = day.closest(`[role="gridcell"]`);
        const buttonSelected = day.getAttribute(`data-selected`) === `true` ||
            day.getAttribute(`data-selected-single`) === `true` ||
            day.getAttribute(`aria-selected`) === `true`;
        const cellSelected = cell?.getAttribute(`aria-selected`) === `true` ||
            cell?.getAttribute(`data-selected`) === `true`;
        expect(buttonSelected || cellSelected).toBe(true);
    });

    it(`fires onSelect when the user picks a day in single mode`, async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <Calendar month={NOV_2026} mode={`single`} onSelect={onSelect} />
        );
        await user.click(screen.getByRole(`button`, { name: /Tuesday, November 10/i }));
        expect(onSelect).toHaveBeenCalledTimes(1);
        const arg = onSelect.mock.calls[0]![0] as Date;
        expect(arg.getDate()).toBe(10);
        expect(arg.getMonth()).toBe(10);
    });

    it(`disableFuture disables every day after today`, () => {
        const today = new Date();
        const visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        render(<Calendar month={visibleMonth} disableFuture />);
        const dayAfter = new Date(today);
        dayAfter.setDate(today.getDate() + 1);
        // Future day on the same month — should be disabled. We look for a
        // day cell whose accessible name contains tomorrow's date string.
        const monthLong = visibleMonth.toLocaleDateString(`en-US`, { month: `long` });
        const matcher = new RegExp(`${monthLong} ${dayAfter.getDate()}\\b`);
        const all = screen.queryAllByRole(`button`, { name: matcher });
        // Only assert when tomorrow exists inside the visible month grid.
        if (all.length > 0) {
            expect(all[0]).toBeDisabled();
        }
    });

    it(`navigates to the next month when the next-month button is clicked`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [m, setM] = useState(NOV_2026);
            return (
                <>
                    <Calendar month={m} onMonthChange={setM} />
                    <span data-testid={`label`}>{m.getMonth()}</span>
                </>
            );
        };
        render(<Controlled />);
        await user.click(screen.getByRole(`button`, { name: /next month/i }));
        // November (10) → December (11).
        expect(screen.getByTestId(`label`)).toHaveTextContent(`11`);
    });
});
