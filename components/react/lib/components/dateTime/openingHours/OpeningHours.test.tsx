import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OpeningHours from "./OpeningHours";
import {
    buildOpeningHoursStatus,
    buildOpeningHoursWeek,
    DEFAULT_OPENING_HOURS_STRINGS,
    parseOsmOpeningHours
} from "./types";

const LOCALE = `en-US`;

// Fix every test to the same wall-clock moment so weekday/highlight
// assertions stay deterministic across CI machines. Wednesday, 15
// Jan 2026 at 10:00 local time. JS month is zero-indexed, so 0 == Jan.
const FIXED_NOW = new Date(2026, 0, 14, 10, 0, 0);

const MO_FR_RULE = `Mo-Fr 09:00-18:00; Sa 10:00-14:00`;

describe(`OpeningHours`, () => {
    it(`renders nothing when rules are empty`, () => {
        const { container } = render(<OpeningHours rules={``} now={FIXED_NOW} locale={LOCALE} />);
        expect(container).toBeEmptyDOMElement();
    });

    it(`renders nothing when rules are garbage`, () => {
        const { container } = render(
            <OpeningHours rules={`not a real opening_hours value !@#$`} now={FIXED_NOW} locale={LOCALE} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it(`shows the open headline and a "closes at" detail when currently open`, () => {
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={FIXED_NOW}
                locale={LOCALE}
                data-testid={`oh`}
                variant={`status`}
            />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(DEFAULT_OPENING_HOURS_STRINGS.open)).toBeInTheDocument();
        // 09:00–18:00 on a Wednesday at 10:00 → detail should mention 18:00
        expect(within(root).getByText(/18:00/)).toBeInTheDocument();
    });

    it(`marks the status as closingSoon when within an hour of close`, () => {
        const closingSoonNow = new Date(2026, 0, 14, 17, 30, 0); // Wed 17:30, rule closes 18:00
        render(
            <OpeningHours rules={MO_FR_RULE} now={closingSoonNow} locale={LOCALE} data-testid={`oh`} />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(DEFAULT_OPENING_HOURS_STRINGS.closingSoon)).toBeInTheDocument();
        // "in 30 minutes (at 18:00)"
        expect(within(root).getByText(/30/)).toBeInTheDocument();
    });

    it(`shows the closed headline and an "opens at" detail when closed`, () => {
        const beforeOpening = new Date(2026, 0, 14, 7, 0, 0); // Wed 07:00, rule opens 09:00
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={beforeOpening}
                locale={LOCALE}
                data-testid={`oh`}
                variant={`status`}
            />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(DEFAULT_OPENING_HOURS_STRINGS.closed)).toBeInTheDocument();
        expect(within(root).getByText(/09:00/)).toBeInTheDocument();
    });

    it(`renders the seven-day strip with today highlighted`, () => {
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={FIXED_NOW}
                locale={LOCALE}
                collapsible={false}
                data-testid={`oh`}
            />
        );
        const rows = screen.getByTestId(`oh`).querySelectorAll(`tbody tr`);
        expect(rows).toHaveLength(7);
        const todays = Array.from(rows).filter((r) => r.getAttribute(`data-today`) === `true`);
        expect(todays).toHaveLength(1);
        // Sunday closed under the rule, Saturday limited — assert one of those rows.
        const labels = Array.from(rows).map((r) => r.querySelector(`th`)?.textContent ?? ``);
        // Default weekStart=monday with locale en-US → first label is "Mon"
        expect(labels[0]).toMatch(/Mon/);
        expect(labels[6]).toMatch(/Sun/);
    });

    it(`omits the table when variant="status"`, () => {
        render(
            <OpeningHours rules={MO_FR_RULE} now={FIXED_NOW} locale={LOCALE} variant={`status`} data-testid={`oh`} />
        );
        expect(screen.queryByRole(`table`)).not.toBeInTheDocument();
        expect(screen.getByTestId(`oh`)).toHaveAttribute(`data-variant`, `status`);
    });

    it(`omits the status when variant="week"`, () => {
        render(
            <OpeningHours rules={MO_FR_RULE} now={FIXED_NOW} locale={LOCALE} variant={`week`} data-testid={`oh`} />
        );
        const root = screen.getByTestId(`oh`);
        expect(root.querySelector(`table`)).toBeInTheDocument();
        expect(root.textContent ?? ``).not.toContain(DEFAULT_OPENING_HOURS_STRINGS.open);
    });

    it(`uses the alwaysOpen headline for 24/7 rules`, () => {
        render(
            <OpeningHours
                rules={`24/7`}
                now={FIXED_NOW}
                locale={LOCALE}
                collapsible={false}
                data-testid={`oh`}
            />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(DEFAULT_OPENING_HOURS_STRINGS.alwaysOpen)).toBeInTheDocument();
    });

    it(`accepts a pre-parsed schedule and skips internal parsing`, () => {
        // Use the helper to mint a schedule, then render with `schedule`
        // and a deliberately unparsable `rules` to prove `schedule` wins.
        const oh = parseOsmOpeningHours(MO_FR_RULE);
        const status = buildOpeningHoursStatus(oh, FIXED_NOW, {
            locale: LOCALE,
            strings: DEFAULT_OPENING_HOURS_STRINGS
        });
        const week = buildOpeningHoursWeek(oh, FIXED_NOW, { locale: LOCALE });
        render(
            <OpeningHours
                schedule={{ status, week }}
                rules={`garbage`}
                now={FIXED_NOW}
                locale={LOCALE}
                collapsible={false}
                data-testid={`oh`}
            />
        );
        expect(screen.getByTestId(`oh`).querySelectorAll(`tbody tr`)).toHaveLength(7);
        expect(within(screen.getByTestId(`oh`)).getByText(DEFAULT_OPENING_HOURS_STRINGS.open)).toBeInTheDocument();
    });

    it(`clamps cross-midnight intervals at the day boundary as 24:00`, () => {
        // 22:00–02:00 should render as 22:00–24:00 on day N and
        // 00:00–02:00 on day N+1. Build the week directly to assert.
        const oh = parseOsmOpeningHours(`Mo-Su 22:00-02:00`);
        const week = buildOpeningHoursWeek(oh, FIXED_NOW, { locale: LOCALE });
        for (const day of week) {
            // Each day should have at least one interval ending at 24:00
            const labels = day.intervals.map((iv) => `${iv.fromLabel}-${iv.toLabel}`);
            expect(labels.some((l) => l.endsWith(`-24:00`))).toBe(true);
        }
    });

    it(`renders translation overrides for headline + detail`, () => {
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={FIXED_NOW}
                locale={LOCALE}
                strings={{ open: `Geöffnet`, closesAt: `schließt um {time}` }}
                collapsible={false}
                data-testid={`oh`}
            />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(`Geöffnet`)).toBeInTheDocument();
        expect(within(root).getByText(/schließt um 18:00/)).toBeInTheDocument();
    });

    it(`hides the week table behind a disclosure by default and reveals it on toggle`, async () => {
        const user = (await import(`@testing-library/user-event`)).default.setup();
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={FIXED_NOW}
                locale={LOCALE}
                data-testid={`oh`}
            />
        );
        // The status line is the trigger; the week table is not in the
        // DOM until the disclosure opens.
        expect(screen.queryByRole(`table`)).not.toBeInTheDocument();
        const trigger = screen.getByRole(`button`, {
            name: DEFAULT_OPENING_HOURS_STRINGS.scheduleLabel
        });
        expect(trigger).toHaveAttribute(`aria-expanded`, `false`);
        await user.click(trigger);
        expect(trigger).toHaveAttribute(`aria-expanded`, `true`);
        const rows = screen.getByRole(`table`).querySelectorAll(`tbody tr`);
        expect(rows).toHaveLength(7);
    });

    it(`starts open when defaultOpen is true`, () => {
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={FIXED_NOW}
                locale={LOCALE}
                defaultOpen
                data-testid={`oh`}
            />
        );
        const trigger = screen.getByRole(`button`, {
            name: DEFAULT_OPENING_HOURS_STRINGS.scheduleLabel
        });
        expect(trigger).toHaveAttribute(`aria-expanded`, `true`);
        expect(screen.getByRole(`table`).querySelectorAll(`tbody tr`)).toHaveLength(7);
    });

    it(`picks bundled German strings when locale="de" without explicit strings prop`, () => {
        // Wed 07:00 — closed until 09:00. With the German bundle the
        // headline should be "Geschlossen" and the detail
        // "öffnet um 09:00", without the caller passing any strings.
        const beforeOpening = new Date(2026, 0, 14, 7, 0, 0);
        render(
            <OpeningHours
                rules={MO_FR_RULE}
                now={beforeOpening}
                locale={`de`}
                collapsible={false}
                data-testid={`oh`}
            />
        );
        const root = screen.getByTestId(`oh`);
        expect(within(root).getByText(`Geschlossen`)).toBeInTheDocument();
        expect(within(root).getByText(/öffnet um 09:00/)).toBeInTheDocument();
        // The scheduleLabel for `<table aria-label>` should also be German.
        expect(root.querySelector(`table`)?.getAttribute(`aria-label`)).toBe(`Öffnungszeiten`);
    });
});
