import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TimezoneSelector from "./TimezoneSelector";

describe(`TimezoneSelector`, () => {
    it(`renders the trigger button`, () => {
        render(<TimezoneSelector value={`Europe/Berlin`} onChange={() => undefined} />);
        expect(screen.getByRole(`combobox`)).toBeInTheDocument();
    });

    it(`shows the selected timezone on the trigger`, () => {
        render(<TimezoneSelector value={`Europe/Berlin`} onChange={() => undefined} />);
        expect(screen.getByRole(`combobox`)).toHaveTextContent(/Berlin/);
    });

    it(`opens a search list when the trigger is clicked`, async () => {
        const user = userEvent.setup();
        render(<TimezoneSelector value={`Europe/Berlin`} onChange={() => undefined} />);
        await user.click(screen.getByRole(`combobox`));
        // The Command primitive renders an input with role="combobox" or
        // role="searchbox" depending on version. Find the textbox that appears.
        expect(screen.getByRole(`listbox`)).toBeInTheDocument();
    });

    it(`fires onChange when the user picks a timezone`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimezoneSelector value={`UTC`} onChange={onChange} />);
        await user.click(screen.getByRole(`combobox`));
        // Type to filter, then pick a known TZ.
        const input = screen.getByPlaceholderText(/timezone|zone|search/i);
        await user.type(input, `Berlin`);
        const option = await screen.findByText(/Berlin/);
        await user.click(option);
        expect(onChange).toHaveBeenCalled();
        expect(onChange.mock.calls[0]![0]).toMatch(/Berlin/);
    });

    it(`is fully controllable via value + onChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [tz, setTz] = useState(`UTC`);
            return (
                <>
                    <TimezoneSelector value={tz} onChange={setTz} />
                    <span data-testid={`tz`}>{tz}</span>
                </>
            );
        };
        render(<Controlled />);
        await user.click(screen.getByRole(`combobox`));
        const input = screen.getByPlaceholderText(/timezone|zone|search/i);
        await user.type(input, `Berlin`);
        const option = await screen.findByText(/Berlin/);
        await user.click(option);
        expect(screen.getByTestId(`tz`)).toHaveTextContent(/Berlin/);
    });

    it(`disabled prevents opening the popover`, async () => {
        const user = userEvent.setup();
        render(<TimezoneSelector value={`UTC`} onChange={() => undefined} disabled />);
        const trigger = screen.getByRole(`combobox`);
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        expect(screen.queryByRole(`listbox`)).toBeNull();
    });
});
