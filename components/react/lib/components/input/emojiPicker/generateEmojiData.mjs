// @ts-check
/**
 * Generates `emojiData.generated.ts` for `<EmojiPicker>` from the authoritative
 * Unicode CLDR dataset shipped in `emojibase-data` (a pinned devDependency).
 *
 * Why generate instead of hand-curate: the old dataset was a hand-picked ~500
 * subset, so categories like "flags" were incomplete. This script emits the
 * COMPLETE base set (skin-tone variants are applied at runtime, so only base
 * emoji are listed) and runs as part of `build:lib` — bump `emojibase-data` to
 * pick up newly released Unicode emoji and the next build regenerates.
 *
 * Deterministic by construction (stable sort, no timestamps), so the same
 * emojibase-data version always produces a byte-identical file → reproducible
 * builds. `emojiData.test.ts` asserts the committed file matches the source.
 *
 * Run directly: `node lib/components/input/emojiPicker/generateEmojiData.mjs`
 * or via `pnpm run generate:emoji`.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** @type {Array<{emoji:string,label:string,tags?:string[],group?:number,order?:number,skins?:unknown[]}>} */
const data = require("emojibase-data/en/data.json");
const pkg = require("emojibase-data/package.json");

// emojibase group id → our picker category id. Group 2 ("component": skin-tone
// and hair modifiers) and group-less entries (the lone regional-indicator
// letters that only exist to compose flags) are intentionally excluded.
/** @type {Record<number, string>} */
const GROUP_TO_CATEGORY = {
    0: `smileys`, // smileys-emotion
    1: `people`, // people-body
    3: `animals`, // animals-nature
    4: `food`, // food-drink
    5: `travel`, // travel-places
    6: `activities`, // activities
    7: `objects`, // objects
    8: `symbols`, // symbols
    9: `flags` // flags
};

// Render order of the category sections / tabs — used as the primary sort key
// so the generated list groups cleanly per category (intra-category order is
// the Unicode `order`).
const CATEGORY_ORDER = [
    `smileys`,
    `people`,
    `animals`,
    `food`,
    `activities`,
    `travel`,
    `objects`,
    `symbols`,
    `flags`
];
const categoryRank = new Map(CATEGORY_ORDER.map((id, i) => [id, i]));

const rows = data
    .filter((e) => e.group !== undefined && GROUP_TO_CATEGORY[e.group] !== undefined)
    .map((e) => {
        const category = GROUP_TO_CATEGORY[/** @type {number} */ (e.group)];
        return {
            char: e.emoji,
            name: e.label,
            keywords: Array.from(new Set(e.tags ?? [])).join(` `),
            category,
            hasSkinTone: Array.isArray(e.skins) && e.skins.length > 0 ? 1 : 0,
            order: typeof e.order === `number` ? e.order : 0
        };
    })
    .sort((a, b) => {
        const ra = categoryRank.get(a.category) ?? 0;
        const rb = categoryRank.get(b.category) ?? 0;
        if (ra !== rb) return ra - rb;
        if (a.order !== b.order) return a.order - b.order;
        return a.char < b.char ? -1 : a.char > b.char ? 1 : 0;
    });

const body = rows
    .map(
        (r) =>
            `    [${JSON.stringify(r.char)}, ${JSON.stringify(r.name)}, ` +
            `${JSON.stringify(r.keywords)}, ${JSON.stringify(r.category)}, ${r.hasSkinTone}]`
    )
    .join(`,\n`);

const out = `/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Source: emojibase-data@${pkg.version} (Unicode CLDR). Regenerate with
// \`pnpm run generate:emoji\`; \`build:lib\` runs it automatically. To add
// newly released Unicode emoji, bump the emojibase-data dependency and rebuild.
//
// Skin-tone variants are NOT listed individually — they are applied at runtime
// (see applySkinTone); the trailing 0|1 flags whether an emoji accepts a tone.
import type { EmojiCategoryId } from "./emojiData";

export type GeneratedEmojiRow = readonly [
    char: string,
    name: string,
    keywords: string,
    category: EmojiCategoryId,
    hasSkinTone: 0 | 1
];

export const GENERATED_FROM = ${JSON.stringify(`emojibase-data@${pkg.version}`)};
export const GENERATED_EMOJI_COUNT = ${rows.length};

export const GENERATED_EMOJIS: ReadonlyArray<GeneratedEmojiRow> = [
${body}
];
`;

const target = join(here, `emojiData.generated.ts`);
writeFileSync(target, out, `utf8`);
console.log(
    `emojiData.generated.ts: ${rows.length} emoji from emojibase-data@${pkg.version} ` +
        `(${rows.filter((r) => r.hasSkinTone).length} skin-toneable, ` +
        `${rows.filter((r) => r.category === `flags`).length} flags)`
);
