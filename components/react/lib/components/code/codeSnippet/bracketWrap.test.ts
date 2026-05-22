import { describe, expect, it } from "vitest";
import { wrapBracketsInHtml } from "./bracketWrap";

const TS_PAIRS = [
    [`(`, `)`],
    [`[`, `]`],
    [`{`, `}`]
] as const;

const countMatches = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

describe(`wrapBracketsInHtml`, () => {
    it(`wraps a flat paren pair at depth 0`, () => {
        const out = wrapBracketsInHtml(`(x)`, { bracketPairs: TS_PAIRS });
        expect(out).toBe(`<span class="mows-bracket-0">(</span>x<span class="mows-bracket-0">)</span>`);
    });

    it(`increases depth for nested brackets`, () => {
        const out = wrapBracketsInHtml(`(a(b))`, { bracketPairs: TS_PAIRS });
        expect(out).toContain(`<span class="mows-bracket-0">(</span>a`);
        expect(out).toContain(`<span class="mows-bracket-1">(</span>b`);
        // Two closes at depths 1 and 0 respectively.
        expect(out).toMatch(/mows-bracket-1">\)<\/span><span class="mows-bracket-0">\)/);
    });

    it(`cycles the palette by depth modulo paletteSize (default 3)`, () => {
        const out = wrapBracketsInHtml(`((((x))))`, { bracketPairs: TS_PAIRS });
        // Depths 0,1,2,0 — class 0 appears twice on opens, class 0/1/2 on closes
        expect(countMatches(out, /mows-bracket-0">\(/g)).toBe(2);
        expect(countMatches(out, /mows-bracket-1">\(/g)).toBe(1);
        expect(countMatches(out, /mows-bracket-2">\(/g)).toBe(1);
    });

    it(`skips brackets inside double-quoted strings`, () => {
        const out = wrapBracketsInHtml(`"(a)"`, { bracketPairs: TS_PAIRS });
        expect(out).not.toContain(`mows-bracket`);
    });

    it(`skips brackets inside single-quoted strings`, () => {
        const out = wrapBracketsInHtml(`'(a)'`, { bracketPairs: TS_PAIRS });
        expect(out).not.toContain(`mows-bracket`);
    });

    it(`skips brackets inside template literals`, () => {
        const out = wrapBracketsInHtml(`\`(a)\``, { bracketPairs: TS_PAIRS });
        expect(out).not.toContain(`mows-bracket`);
    });

    it(`treats backslash-escaped quotes as not terminating a string`, () => {
        // Source: "\"(a)" — opens string, escaped quote, paren stays inside string, escaped quote, close string
        const out = wrapBracketsInHtml(`"\\"(a)\\""`, { bracketPairs: TS_PAIRS });
        expect(out).not.toContain(`mows-bracket`);
    });

    it(`skips brackets inside line comments terminated by \\n`, () => {
        const out = wrapBracketsInHtml(`//(skip)\n(count)`, { bracketPairs: TS_PAIRS });
        expect(out).toContain(`(skip)`);
        expect(out).toContain(`mows-bracket-0">(</span>count`);
    });

    it(`treats <br> tags as a line-comment terminator`, () => {
        const out = wrapBracketsInHtml(`//(skip)<br>(count)`, { bracketPairs: TS_PAIRS });
        expect(out).toContain(`mows-bracket-0">(</span>count`);
        // The (skip) part inside the line comment must NOT have been wrapped.
        expect(out).not.toMatch(/mows-bracket-\d">\(<\/span>skip/);
    });

    it(`skips brackets inside block comments`, () => {
        const out = wrapBracketsInHtml(`/*(skip)*/(count)`, { bracketPairs: TS_PAIRS });
        // Only the (count) pair = 2 wraps.
        expect(countMatches(out, /mows-bracket/g)).toBe(2);
    });

    it(`returns the input unchanged when bracketPairs is empty`, () => {
        const html = `(foo)`;
        expect(wrapBracketsInHtml(html, { bracketPairs: [] })).toBe(html);
    });

    it(`leaves HTML entities and other tokens untouched`, () => {
        // Models Monaco's escaping: `<` and `>` come out as `&lt;` / `&gt;`.
        const out = wrapBracketsInHtml(
            `<span class="mtk1">&lt;div&gt;(x)</span>`,
            { bracketPairs: TS_PAIRS }
        );
        // The span open + close stay intact.
        expect(out.startsWith(`<span class="mtk1">&lt;div&gt;`)).toBe(true);
        expect(out.endsWith(`</span>`)).toBe(true);
        // The paren inside got wrapped.
        expect(out).toContain(`<span class="mows-bracket-0">(</span>`);
    });

    it(`survives an unmatched close at depth 0 without underflow`, () => {
        const out = wrapBracketsInHtml(`)(x)`, { bracketPairs: TS_PAIRS });
        // The leading `)` should still get a class; depth stays clamped at 0.
        expect(out).toMatch(/^<span class="mows-bracket-0">\)<\/span>/);
        // And the following balanced pair stays at depth 0.
        expect(out).toContain(`<span class="mows-bracket-0">(</span>x<span class="mows-bracket-0">)</span>`);
    });

    it(`respects custom classPrefix and paletteSize`, () => {
        const out = wrapBracketsInHtml(`((((x))))`, {
            bracketPairs: TS_PAIRS,
            classPrefix: `bk`,
            paletteSize: 2
        });
        expect(out).toMatch(/class="bk-0">/);
        expect(out).toMatch(/class="bk-1">/);
        expect(out).not.toMatch(/class="bk-2">/);
    });

    it(`only counts pairs that appear in bracketPairs (e.g. JSON skips parens)`, () => {
        const jsonPairs = [
            [`{`, `}`],
            [`[`, `]`]
        ] as const;
        const out = wrapBracketsInHtml(`{"value":"(x)"}`, { bracketPairs: jsonPairs });
        // The `{`/`}` pair is wrapped; the parens inside the string are not.
        expect(out).toContain(`<span class="mows-bracket-0">{</span>`);
        expect(out).toContain(`<span class="mows-bracket-0">}</span>`);
        expect(countMatches(out, /mows-bracket/g)).toBe(2);
    });
});
