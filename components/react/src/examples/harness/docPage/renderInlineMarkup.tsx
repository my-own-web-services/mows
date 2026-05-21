import * as React from "react";
import CodeSnippet from "../../../../lib/components/code/codeSnippet/CodeSnippet";

// Matches either a backtick-wrapped span ( `…` ) or a JSX-tag reference
// like `<Steps>` / `<Step />` / `</Steps>`. The two capture groups
// distinguish the two cases so the renderer can strip the backticks from
// the first form.
const INLINE_CODE_REGEX = /(`[^`]+`)|(<\/?[A-Z][A-Za-z0-9]*\s*\/?>)/g;

interface InlineCodeChipProps {
    readonly code: string;
}

/**
 * Inline code chip backed by the same `<CodeSnippet mode="inline">` that
 * powers larger code blocks — so every inline reference picks up the
 * active Monaco theme (token colors + background) instead of using a
 * separate static palette that drifts visually from the surrounding
 * code blocks.
 *
 * Language is always `tsx`: prose inline references are overwhelmingly
 * JSX tags (`<Steps>`) or TS-flavoured snippets (`mode="selection"`,
 * `aria-current`), and TSX is a superset that lexes both correctly.
 */
const InlineCodeChip = ({ code }: InlineCodeChipProps) => (
    <CodeSnippet mode={`inline`} language={`tsx`} code={code} />
);

/**
 * Promotes inline code fragments inside a body string to
 * `<InlineCodeChip>` spans, so prose like "Wrap `<Steps>` in
 * `dir=\"rtl\"`" renders the identifiers as code chips instead of plain
 * text.
 *
 * Two patterns are recognised:
 *
 * - Markdown-style backticks: `` `mode="selection"` `` — the backticks
 *   are stripped from the output and the inner text becomes the chip.
 * - JSX-style tag references that appear bare in prose: `<Steps>` /
 *   `<Step />` — wrapped as-is.
 *
 * Any text outside the matches is preserved verbatim.
 */
export const renderInlineMarkup = (text: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let lastIndex = 0;
    let i = 0;
    const re = new RegExp(INLINE_CODE_REGEX);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex) {
            out.push(text.slice(lastIndex, match.index));
        }
        const backtickMatch = match[1];
        const code = backtickMatch ? backtickMatch.slice(1, -1) : (match[2] ?? ``);
        out.push(<InlineCodeChip key={`inline-${i++}`} code={code} />);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) out.push(text.slice(lastIndex));
    return out;
};

/**
 * Convenience wrapper: if the given description is a string, promote its
 * code fragments via `renderInlineMarkup`. ReactNode passthroughs (already
 * structured content) are returned unchanged.
 */
export const renderDescription = (
    description: React.ReactNode | undefined
): React.ReactNode | undefined => {
    if (typeof description === `string`) {
        return renderInlineMarkup(description);
    }
    return description;
};
