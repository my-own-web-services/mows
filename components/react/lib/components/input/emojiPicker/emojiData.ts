/**
 * Emoji dataset shipped with `<EmojiPicker>`.
 *
 * The raw list lives in `emojiData.generated.ts`, which is produced from the
 * authoritative Unicode CLDR dataset (`emojibase-data`) by
 * `generateEmojiData.mjs` as part of `build:lib`. It is the COMPLETE base set
 * (every category fully populated — e.g. all ~270 flags, not a hand-picked
 * subset). Skin-tone variants are not listed individually; they are applied at
 * runtime (see {@link applySkinTone}), keeping the list to one row per emoji.
 *
 * To add newly released Unicode emoji, bump the `emojibase-data` dependency and
 * rebuild — the generator re-emits the data and `emojiData.test.ts` asserts the
 * committed file still matches the source (no missing emoji).
 *
 * Each runtime entry exposes `char`, `name`, lower-cased `keywords` (for O(n)
 * search), `category` and `hasSkinTone`.
 */

import { GENERATED_EMOJIS } from "./emojiData.generated";

export type EmojiCategoryId =
    | `smileys`
    | `people`
    | `animals`
    | `food`
    | `activities`
    | `travel`
    | `objects`
    | `symbols`
    | `flags`;

export interface EmojiCategoryDefinition {
    readonly id: EmojiCategoryId;
    /** A lucide-react icon name string used by `<EmojiPicker>` to pick a glyph. */
    readonly iconEmoji: string;
}

export const EMOJI_CATEGORIES: ReadonlyArray<EmojiCategoryDefinition> = [
    { id: `smileys`, iconEmoji: `😀` },
    { id: `people`, iconEmoji: `👋` },
    { id: `animals`, iconEmoji: `🐶` },
    { id: `food`, iconEmoji: `🍕` },
    { id: `activities`, iconEmoji: `⚽` },
    { id: `travel`, iconEmoji: `🚗` },
    { id: `objects`, iconEmoji: `💡` },
    { id: `symbols`, iconEmoji: `❤️` },
    { id: `flags`, iconEmoji: `🏳️` }
];

export interface EmojiEntry {
    readonly char: string;
    readonly name: string;
    readonly keywords: ReadonlyArray<string>;
    readonly category: EmojiCategoryId;
    readonly hasSkinTone: boolean;
}

/**
 * Fitzpatrick skin-tone modifier code points. Index 0 is "default" (no
 * modifier), 1–5 are the Unicode FITZPATRICK TYPE-1 through TYPE-6
 * modifiers (1-2 is a single modifier covering both lightest tones).
 */
export const SKIN_TONE_MODIFIERS: ReadonlyArray<string> = [
    ``,
    `\u{1F3FB}`,
    `\u{1F3FC}`,
    `\u{1F3FD}`,
    `\u{1F3FE}`,
    `\u{1F3FF}`
];

export type SkinToneIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Apply a Fitzpatrick skin tone to an emoji that supports it. Falls back
 * to the bare character when the index is 0 or the emoji is not in the
 * skin-tone set. The membership check is sourced from the dataset (see
 * SKIN_TONE_CAPABLE_CHARS below) so callers can apply this function
 * uniformly across a row of mixed entries without leaking spurious
 * modifiers onto cats / hearts / etc.
 */
export const applySkinTone = (char: string, toneIndex: SkinToneIndex): string => {
    if (toneIndex === 0) return char;
    if (!SKIN_TONE_CAPABLE_CHARS.has(char)) return char;
    const modifier = SKIN_TONE_MODIFIERS[toneIndex];
    if (modifier === undefined || modifier === ``) return char;
    return char + modifier;
};

export const EMOJI_DATA: ReadonlyArray<EmojiEntry> = GENERATED_EMOJIS.map(
    ([char, name, keywords, category, hasSkinTone]) => ({
        char,
        name,
        keywords: keywords.length > 0 ? keywords.split(/\s+/) : [],
        category,
        hasSkinTone: hasSkinTone === 1
    })
);

// Index by category for O(1) tab-switch lookup. Filtering on every render
// adds up at ~1900 entries; the picker reads from this map instead.
const indexByCategory = new Map<EmojiCategoryId, EmojiEntry[]>();
for (const entry of EMOJI_DATA) {
    const bucket = indexByCategory.get(entry.category);
    if (bucket) bucket.push(entry);
    else indexByCategory.set(entry.category, [entry]);
}

// Set membership lookup for `applySkinTone` — see the function comment.
const SKIN_TONE_CAPABLE_CHARS = new Set<string>(
    EMOJI_DATA.filter((entry) => entry.hasSkinTone).map((entry) => entry.char)
);

export const emojisInCategory = (id: EmojiCategoryId): ReadonlyArray<EmojiEntry> => {
    return indexByCategory.get(id) ?? [];
};

/**
 * Case-insensitive prefix-and-contains search across name + keywords.
 * Splits the query on whitespace and AND-matches every token so multi-word
 * queries like "smile cat" both narrow the result set.
 */
export const searchEmojis = (query: string): ReadonlyArray<EmojiEntry> => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return [];
    const tokens = normalized.split(/\s+/);
    return EMOJI_DATA.filter((entry) => {
        const haystack = `${entry.name} ${entry.keywords.join(` `)}`;
        return tokens.every((tok) => haystack.includes(tok));
    });
};
