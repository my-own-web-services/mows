// Post-processor that wraps bracket characters in Monaco-colorized HTML
// with depth-cycling color spans. Monaco's `bracketPairColorization`
// editor option only fires inside a live `<Editor>` instance — the
// `monaco.editor.colorize()` API used by `<CodeSnippet>` returns static
// HTML with no bracket awareness. This helper closes that gap without
// touching token coloring: the existing `<span class="mtkN">` wrappers
// are preserved verbatim, and we only inject extra inner spans around
// the bracket characters themselves.
//
// Pure function — no DOM access — so it is trivial to unit-test against
// hand-rolled fixtures, which matters because Monaco can't run in jsdom.

export interface BracketWrapOptions {
    readonly bracketPairs: readonly (readonly [string, string])[];
    readonly classPrefix?: string;
    readonly paletteSize?: number;
}

interface ScanState {
    depth: number;
    stringChar: string | null;
    escaped: boolean;
    inLineComment: boolean;
    inBlockComment: boolean;
}

const matchBrTag = (html: string, i: number): number => {
    // Returns the end index (exclusive) of an <br>, <br/>, <br /> tag
    // starting at i, or -1 if no such tag is there. Case-insensitive.
    if (html[i] !== `<`) return -1;
    let j = i + 1;
    if (html[j] === `/`) return -1;
    if ((html[j] ?? ``).toLowerCase() !== `b`) return -1;
    j++;
    if ((html[j] ?? ``).toLowerCase() !== `r`) return -1;
    j++;
    // Optional whitespace + optional self-closing slash + `>`
    while (j < html.length && (html[j] === ` ` || html[j] === `\t`)) j++;
    if (html[j] === `/`) j++;
    if (html[j] !== `>`) return -1;
    return j + 1;
};

export const wrapBracketsInHtml = (
    html: string,
    { bracketPairs, classPrefix = `mows-bracket`, paletteSize = 3 }: BracketWrapOptions
): string => {
    if (bracketPairs.length === 0 || paletteSize <= 0) return html;

    const opens = new Set<string>();
    const closes = new Set<string>();
    for (const [o, c] of bracketPairs) {
        opens.add(o);
        closes.add(c);
    }

    const state: ScanState = {
        depth: 0,
        stringChar: null,
        escaped: false,
        inLineComment: false,
        inBlockComment: false
    };

    let out = ``;
    let i = 0;
    const len = html.length;

    while (i < len) {
        const ch = html[i]!;
        const next = i + 1 < len ? html[i + 1]! : ``;

        // <br> family — treat as a newline so line-comments terminate
        // across Monaco's br-separated line splits.
        const brEnd = matchBrTag(html, i);
        if (brEnd !== -1) {
            if (state.inLineComment) state.inLineComment = false;
            out += html.slice(i, brEnd);
            i = brEnd;
            continue;
        }

        // Any other HTML tag: copy through as opaque.
        if (ch === `<`) {
            const end = html.indexOf(`>`, i);
            if (end === -1) {
                out += html.slice(i);
                break;
            }
            out += html.slice(i, end + 1);
            i = end + 1;
            continue;
        }

        // HTML entity: pass through unchanged. Entities are never bracket
        // characters (`(`, `[`, `{`, `)`, `]`, `}` are all literal), and
        // they're never string delimiters either.
        if (ch === `&`) {
            const end = html.indexOf(`;`, i);
            if (end !== -1 && end - i <= 8) {
                out += html.slice(i, end + 1);
                i = end + 1;
                continue;
            }
            // Standalone `&` — fall through to normal handling.
        }

        // Comment / string state — copy the char and advance state.
        if (state.inLineComment) {
            if (ch === `\n`) state.inLineComment = false;
            out += ch;
            i++;
            continue;
        }
        if (state.inBlockComment) {
            if (ch === `*` && next === `/`) {
                out += `*/`;
                i += 2;
                state.inBlockComment = false;
                continue;
            }
            out += ch;
            i++;
            continue;
        }
        if (state.stringChar !== null) {
            if (state.escaped) {
                state.escaped = false;
                out += ch;
                i++;
                continue;
            }
            if (ch === `\\`) {
                state.escaped = true;
                out += ch;
                i++;
                continue;
            }
            if (ch === state.stringChar) state.stringChar = null;
            out += ch;
            i++;
            continue;
        }

        // Enter comment / string states.
        if (ch === `/` && next === `/`) {
            state.inLineComment = true;
            out += `//`;
            i += 2;
            continue;
        }
        if (ch === `/` && next === `*`) {
            state.inBlockComment = true;
            out += `/*`;
            i += 2;
            continue;
        }
        if (ch === `"` || ch === `'` || ch === `\``) {
            state.stringChar = ch;
            out += ch;
            i++;
            continue;
        }

        // Bracket characters: wrap with the depth-color span.
        if (opens.has(ch)) {
            const cls = `${classPrefix}-${state.depth % paletteSize}`;
            out += `<span class="${cls}">${ch}</span>`;
            state.depth++;
            i++;
            continue;
        }
        if (closes.has(ch)) {
            state.depth = Math.max(0, state.depth - 1);
            const cls = `${classPrefix}-${state.depth % paletteSize}`;
            out += `<span class="${cls}">${ch}</span>`;
            i++;
            continue;
        }

        out += ch;
        i++;
    }
    return out;
};
