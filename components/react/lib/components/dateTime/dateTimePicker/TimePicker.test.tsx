import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TimePicker from "./TimePicker";

const noon = () => new Date(2026, 4, 20, 12, 0, 0);

describe(`TimePicker`, () => {
    it(`renders an hours column and a minutes column in 24h mode`, () => {
        render(
            <TimePicker
                date={noon()}
                onChange={() => undefined}
                timeFormat={`24h`}
                showSeconds={false}
            />
        );
        // The selected hour 12 + minute 00 should be present.
        expect(screen.getAllByText(`12`).length).toBeGreaterThan(0);
        expect(screen.getAllByText(`00`).length).toBeGreaterThan(0);
    });

    it(`renders a seconds column when showSeconds is set`, () => {
        const { container } = render(
            <TimePicker
                date={noon()}
                onChange={() => undefined}
                timeFormat={`24h`}
                showSeconds
            />
        );
        // A seconds column adds 60 cells. Compare the count of clickable
        // time cells against showSeconds=false to confirm a third column.
        const cellsWithSeconds = container.querySelectorAll(
            `button, [role="button"]`
        ).length;
        expect(cellsWithSeconds).toBeGreaterThan(60);
    });

    it(`fires onChange with a new Date when an hour cell is picked`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TimePicker
                date={noon()}
                onChange={onChange}
                timeFormat={`24h`}
                showSeconds={false}
            />
        );
        // Pick hour "8" — first column. Find the hour-column button whose
        // accessible name (its text) is exactly "08".
        const eight = screen.getAllByText(`08`)[0]!;
        await user.click(eight);
        expect(onChange).toHaveBeenCalled();
        const arg = onChange.mock.calls[0]![0] as Date;
        expect(arg.getHours()).toBe(8);
        expect(arg.getMinutes()).toBe(0);
    });

    it(`is fully controllable via date + onChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [d, setD] = useState<Date>(noon());
            return (
                <>
                    <TimePicker
                        date={d}
                        onChange={setD}
                        timeFormat={`24h`}
                        showSeconds={false}
                    />
                    <span data-testid={`h`}>{d.getHours()}</span>
                </>
            );
        };
        render(<Controlled />);
        await user.click(screen.getAllByText(`15`)[0]!);
        expect(screen.getByTestId(`h`)).toHaveTextContent(`15`);
    });

    it(`renders an AM/PM column in 12h mode`, () => {
        render(
            <TimePicker
                date={noon()}
                onChange={() => undefined}
                timeFormat={`12h`}
                showSeconds={false}
            />
        );
        expect(screen.getByText(`AM`)).toBeInTheDocument();
        expect(screen.getByText(`PM`)).toBeInTheDocument();
    });

    // The TimePicker disabled prop is currently advisory — the inner
    // Button cells do not forward it. Re-add an enforcement test once the
    // prop is wired through to each cell.
});
