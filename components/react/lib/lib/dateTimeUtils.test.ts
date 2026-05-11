import { describe, expect, it } from "vitest";
import {
    formatDateTime,
    getFormatString,
    getPlaceholder,
    parseDateTimeString
} from "./dateTimeUtils";

describe(`dateTimeUtils`, () => {
    describe(`getFormatString`, () => {
        it(`returns 24h without seconds`, () => {
            expect(getFormatString({ timeFormat: `24h`, showSeconds: false })).toBe(
                `yyyy-MM-dd HH:mm`
            );
        });
        it(`returns 24h with seconds`, () => {
            expect(getFormatString({ timeFormat: `24h`, showSeconds: true })).toBe(
                `yyyy-MM-dd HH:mm:ss`
            );
        });
        it(`returns 12h without seconds`, () => {
            expect(getFormatString({ timeFormat: `12h`, showSeconds: false })).toBe(
                `yyyy-MM-dd hh:mm a`
            );
        });
        it(`returns 12h with seconds`, () => {
            expect(getFormatString({ timeFormat: `12h`, showSeconds: true })).toBe(
                `yyyy-MM-dd hh:mm:ss a`
            );
        });
    });

    describe(`getPlaceholder`, () => {
        it(`returns 24h placeholder`, () => {
            expect(getPlaceholder({ timeFormat: `24h`, showSeconds: false })).toBe(
                `yyyy-MM-dd HH:mm`
            );
        });
        it(`returns 12h placeholder with AM/PM`, () => {
            expect(getPlaceholder({ timeFormat: `12h`, showSeconds: false })).toBe(
                `yyyy-MM-dd hh:mm AM/PM`
            );
        });
    });

    describe(`formatDateTime / parseDateTimeString roundtrip`, () => {
        it(`24h roundtrips`, () => {
            const opts = { timeFormat: `24h` as const, showSeconds: false };
            const date = new Date(2026, 4, 9, 14, 35);
            const formatted = formatDateTime(date, opts);
            const parsed = parseDateTimeString(formatted, opts, new Date());
            expect(parsed?.getFullYear()).toBe(2026);
            expect(parsed?.getMonth()).toBe(4);
            expect(parsed?.getDate()).toBe(9);
            expect(parsed?.getHours()).toBe(14);
            expect(parsed?.getMinutes()).toBe(35);
        });
        it(`returns null for invalid input`, () => {
            const parsed = parseDateTimeString(
                `not a date`,
                { timeFormat: `24h`, showSeconds: false },
                new Date()
            );
            expect(parsed).toBeNull();
        });
    });
});
