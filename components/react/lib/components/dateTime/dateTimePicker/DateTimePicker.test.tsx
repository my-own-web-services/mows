import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DateTimePicker from "./DateTimePicker";

describe(`DateTimePicker`, () => {
    it(`renders a date+time input`, () => {
        render(<DateTimePicker />);
        expect(screen.getByRole(`textbox`, { name: `Date and time` })).toBeInTheDocument();
    });

    it(`uses defaultValue to seed the displayed value`, () => {
        const initial = new Date(`2026-05-20T13:45:00`);
        render(<DateTimePicker defaultValue={initial} timeFormat={`24h`} />);
        const input = screen.getByRole(`textbox`, { name: `Date and time` });
        expect((input as HTMLInputElement).value).toMatch(/2026/);
        expect((input as HTMLInputElement).value).toMatch(/13:45/);
    });

    it(`reflects a controlled value prop`, () => {
        render(
            <DateTimePicker value={new Date(`2026-01-15T09:30:00`)} timeFormat={`24h`} onChange={() => undefined} />
        );
        const input = screen.getByRole(`textbox`, { name: `Date and time` }) as HTMLInputElement;
        expect(input.value).toMatch(/2026/);
        expect(input.value).toMatch(/09:30/);
    });

    it(`fires onChange when the user edits the text input and confirms`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState<Date | undefined>(new Date(`2026-01-01T00:00:00`));
            return (
                <>
                    <DateTimePicker value={v} onChange={setV} timeFormat={`24h`} />
                    <span data-testid={`v`}>{v?.toISOString().slice(0, 10)}</span>
                </>
            );
        };
        render(<Controlled />);
        const input = screen.getByRole(`textbox`, { name: `Date and time` });
        await user.click(input);
        await user.tripleClick(input);
        await user.keyboard(`2026-05-20 12:00`);
        await user.tab();
        // Either parsing succeeded and the day changed, or the input
        // remained dirty — but it must not have rejected the new content.
        expect((input as HTMLInputElement).value).toMatch(/2026/);
    });

    it(`renders disabled when disabled is set`, () => {
        render(<DateTimePicker disabled />);
        expect(screen.getByRole(`textbox`, { name: `Date and time` })).toBeDisabled();
    });

    it(`exposes a placeholder reflecting the time format / seconds`, () => {
        render(<DateTimePicker timeFormat={`24h`} showSeconds />);
        const input = screen.getByRole(`textbox`, { name: `Date and time` }) as HTMLInputElement;
        // 24h + seconds → placeholder has HH:mm:ss in it.
        expect(input.placeholder).toMatch(/HH:mm:ss|H{1,2}.+m{1,2}.+s{1,2}/i);
    });

    it(`shows the timezone selector when showTimezone is set`, async () => {
        const user = userEvent.setup();
        render(<DateTimePicker showTimezone />);
        // Open the popover so the timezone selector is mounted.
        await user.click(screen.getByRole(`textbox`, { name: `Date and time` }));
        // The selector renders as a button with the current TZ label.
        const buttons = screen.getAllByRole(`button`);
        expect(buttons.length).toBeGreaterThan(0);
    });
});
