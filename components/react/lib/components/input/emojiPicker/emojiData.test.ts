import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { EMOJI_DATA, emojisInCategory, type EmojiCategoryId } from "./emojiData";

// Completeness guard for the generated dataset (see generateEmojiData.mjs).
// It re-derives the expected pickable set straight from emojibase-data — the
// same authoritative source the generator reads — and fails if the committed
// `emojiData.generated.ts` is missing anything. This is what guarantees "all
// emoji are present": bump emojibase-data without regenerating (or hand-edit
// the data) and this test goes red.
const require = createRequire(import.meta.url);
/** @type {Array<{emoji:string;label:string;group?:number}>} */
const SOURCE: Array<{ emoji: string; label: string; group?: number }> = require(
    `emojibase-data/en/data.json`
);

// Mirror of the generator's mapping. Group 2 (skin-tone/hair components) and
// group-less entries (lone regional-indicator letters) are intentionally out.
const GROUP_TO_CATEGORY: Record<number, EmojiCategoryId> = {
    0: `smileys`,
    1: `people`,
    3: `animals`,
    4: `food`,
    5: `travel`,
    6: `activities`,
    7: `objects`,
    8: `symbols`,
    9: `flags`
};

const expected = SOURCE.filter(
    (e) => e.group !== undefined && GROUP_TO_CATEGORY[e.group] !== undefined
);
const present = new Set(EMOJI_DATA.map((e) => e.char));

describe(`emoji dataset completeness`, () => {
    it(`includes every pickable emoji from emojibase-data (none missing)`, () => {
        const missing = expected
            .filter((e) => !present.has(e.emoji))
            .map((e) => `${e.emoji} ${e.label}`);
        expect(missing).toEqual([]);
    });

    it(`has exactly the expected number of emoji`, () => {
        expect(EMOJI_DATA.length).toBe(expected.length);
    });

    it(`assigns each emoji to the category its Unicode group maps to`, () => {
        const categoryOf = new Map(EMOJI_DATA.map((e) => [e.char, e.category]));
        const misfiled = expected
            .filter((e) => categoryOf.get(e.emoji) !== GROUP_TO_CATEGORY[e.group as number])
            .map((e) => `${e.emoji} ${e.label}`)
            .slice(0, 10);
        expect(misfiled).toEqual([]);
    });

    it(`excludes skin-tone / hair components and bare regional-indicator letters`, () => {
        const excluded = SOURCE.filter((e) => e.group === 2 || e.group === undefined);
        const leaked = excluded.filter((e) => present.has(e.emoji)).map((e) => e.label);
        expect(leaked).toEqual([]);
    });

    it(`has a complete flags category (all country/region flags, not a subset)`, () => {
        const sourceFlags = SOURCE.filter((e) => e.group === 9).length;
        expect(emojisInCategory(`flags`).length).toBe(sourceFlags);
        // Sanity floor: the old curated set had ~54; the full set is ~270.
        expect(emojisInCategory(`flags`).length).toBeGreaterThanOrEqual(250);
    });
});
