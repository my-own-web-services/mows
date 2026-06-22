import { describe, expect, it } from "vitest";

import { computeMove, snapMinutes } from "./dragMath";

describe(`dragMath`, () => {
    it(`snaps minutes to the slot`, () => {
        expect(snapMinutes(67, 30)).toBe(60);
        expect(snapMinutes(75, 15)).toBe(75);
        expect(snapMinutes(82, 30)).toBe(90);
    });

    it(`preserves duration and snaps the new start to the slot`, () => {
        const item = { start: new Date(2026, 5, 16, 9, 0), end: new Date(2026, 5, 16, 10, 0) };
        // Dropped on the 18th, pointer at 14:07, grabbed at the item start.
        const move = computeMove(item, new Date(2026, 5, 18), 14 * 60 + 7, 0, 30, 0, 24);
        expect(move.start).toEqual(new Date(2026, 5, 18, 14, 0));
        expect(move.end).toEqual(new Date(2026, 5, 18, 15, 0));
        expect(move.allDay).toBe(false);
    });

    it(`keeps the grab offset so the block doesn't jump under the cursor`, () => {
        const item = { start: new Date(2026, 5, 16, 9, 0), end: new Date(2026, 5, 16, 10, 0) };
        // Grabbed 30 min into the item; pointer now at 14:30 → start at 14:00.
        const move = computeMove(item, new Date(2026, 5, 16), 14 * 60 + 30, 30, 30, 0, 24);
        expect(move.start.getHours()).toBe(14);
        expect(move.start.getMinutes()).toBe(0);
    });

    it(`clamps inside the [minHour, maxHour) window`, () => {
        const item = { start: new Date(2026, 5, 16, 9, 0), end: new Date(2026, 5, 16, 10, 0) };
        const late = computeMove(item, new Date(2026, 5, 16), 23 * 60 + 45, 0, 30, 0, 24);
        expect(late.start.getHours()).toBe(23); // a 1h item can't start at 23:30
        const early = computeMove(item, new Date(2026, 5, 16), -120, 0, 30, 8, 20);
        expect(early.start.getHours()).toBe(8); // can't start before minHour
    });
});
