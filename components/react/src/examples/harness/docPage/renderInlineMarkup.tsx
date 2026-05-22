import * as React from "react";
import CodeSnippet from "../../../../lib/components/code/codeSnippet/CodeSnippet";
import { lookupComponentPath } from "../../../componentLinkRegistry";

// Matches either a backtick-wrapped span ( `…` ) or a JSX-tag reference
// like `<Steps>` / `<Step />` / `</Steps>`. The two capture groups
// distinguish the two cases so the renderer can strip the backticks from
// the first form.
const INLINE_CODE_REGEX = /(`[^`]+`)|(<\/?[A-Z][A-Za-z0-9]*\s*\/?>)/g;

// JSX-tag inner name extractor. Applied to both the bare `<Foo>` form and
// to backtick-wrapped JSX strings (`` `<Foo>` ``) so authors can use
// either shape and still get cross-doc linking.
const JSX_TAG_NAME_REGEX = /^<\s*\/?\s*([A-Z][A-Za-z0-9]*)/;

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

interface ComponentDocLinkProps {
    readonly name: string;
    readonly code: string;
    readonly path: string;
}

/**
 * Wraps an inline code chip in a doc-page anchor when the chip names a
 * known component / guide. Click + keyboard activation route via
 * `history.pushState` + a `popstate` dispatch — `App.tsx` already listens
 * for that and rehydrates the doc page without a hard browser
 * navigation. Modified clicks (cmd / ctrl / middle / new tab) fall
 * through to the browser's default `<a>` behaviour so power users can
 * still open the target in a new tab.
 *
 * Self-links are suppressed: if the resolved path equals the current
 * pathname, the chip renders without an anchor wrapper. Linking a doc
 * page back to itself adds noise without affordance.
 */
const ComponentDocLink = ({ name, code, path }: ComponentDocLinkProps) => {
    // Same-page mention → render the chip without a link wrapper.
    // `window` guard keeps the SSR / vitest jsdom branches safe.
    if (typeof window !== `undefined` && window.location.pathname === path) {
        return <InlineCodeChip code={code} />;
    }

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
        window.history.pushState({}, ``, path);
        window.dispatchEvent(new PopStateEvent(`popstate`));
    };

    return (
        <a
            href={path}
            onClick={handleClick}
            data-component-doc-link={name}
            aria-label={`Open ${name} documentation`}
            className={`focus-visible:ring-ring decoration-muted-foreground/60 inline rounded-sm decoration-dotted underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none`}
        >
            <InlineCodeChip code={code} />
        </a>
    );
};

const renderChip = (code: string, key: string): React.ReactNode => {
    const tagMatch = code.match(JSX_TAG_NAME_REGEX);
    const tagName = tagMatch?.[1];
    const path = tagName ? lookupComponentPath(tagName) : undefined;
    if (tagName && path) {
        return (
            <ComponentDocLink key={key} name={tagName} code={code} path={path} />
        );
    }
    return <InlineCodeChip key={key} code={code} />;
};

/**
 * Promotes inline code fragments inside a body string to
 * `<InlineCodeChip>` spans (and, where the chip names a registered
 * component / guide, to `<ComponentDocLink>` anchors), so prose like
 * "Wrap `<Steps>` in `dir=\"rtl\"`" renders the identifiers as code
 * chips and the `<Steps>` reference also routes to the Steps doc page.
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
    const output: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyCounter = 0;
    const regex = new RegExp(INLINE_CODE_REGEX);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            output.push(text.slice(lastIndex, match.index));
        }
        const backtickMatch = match[1];
        const code = backtickMatch ? backtickMatch.slice(1, -1) : (match[2] ?? ``);
        output.push(renderChip(code, `inline-${keyCounter++}`));
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) output.push(text.slice(lastIndex));
    return output;
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
