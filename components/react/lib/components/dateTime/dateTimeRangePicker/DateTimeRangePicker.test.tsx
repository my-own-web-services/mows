import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DateTimeRangePicker from "./DateTimeRangePicker";
import type { DateTimeRange } from "./useDateTimeRangePicker";

const initial: DateTimeRange = {
    from: new Date(2026, 4, 15, 9, 0, 0),
    to: new Date(2026, 4, 20, 17, 30, 0)
};

describe(`DateTimeRangePicker`, () => {
    it(`renders two text inputs: start and end`, () => {
        render(<DateTimeRangePicker defaultValue={initial} timeFormat={`24h`} />);
        expect(screen.getByRole(`textbox`, { name: `Start date and time` })).toBeInTheDocument();
        expect(screen.getByRole(`textbox`, { name: `End date and time` })).toBeInTheDocument();
    });

    it(`reflects defaultValue.from on the start input`, () => {
        render(<DateTimeRangePicker defaultValue={initial} timeFormat={`24h`} />);
        const start = screen.getByRole(`textbox`, { name: `Start date and time` }) as HTMLInputElement;
        expect(start.value).toMatch(/2026/);
        expect(start.value).toMatch(/09:00/);
    });

    it(`reflects defaultValue.to on the end input`, () => {
        render(<DateTimeRangePicker defaultValue={initial} timeFormat={`24h`} />);
        const end = screen.getByRole(`textbox`, { name: `End date and time` }) as HTMLInputElement;
        expect(end.value).toMatch(/2026/);
        expect(end.value).toMatch(/17:30/);
    });

    it(`is fully controllable via value + onChange`, () => {
        const Controlled = () => {
            const [v, setV] = useState<DateTimeRange>(initial);
            return (
                <>
                    <DateTimeRangePicker value={v} onChange={setV} timeFormat={`24h`} />
                    <span data-testid={`from`}>{v.from?.getDate()}</span>
                    <span data-testid={`to`}>{v.to?.getDate()}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`from`)).toHaveTextContent(`15`);
        expect(screen.getByTestId(`to`)).toHaveTextContent(`20`);
    });

    it(`disables both inputs when disabled is set`, () => {
        render(<DateTimeRangePicker defaultValue={initial} disabled />);
        expect(screen.getByRole(`textbox`, { name: `Start date and time` })).toBeDisabled();
        expect(screen.getByRole(`textbox`, { name: `End date and time` })).toBeDisabled();
    });
});
