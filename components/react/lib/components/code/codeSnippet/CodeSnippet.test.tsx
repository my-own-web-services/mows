import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CodeSnippet from "./CodeSnippet";
import { safeColorizedHtml } from "./safeColorizedHtml";

// Monaco is heavy and not friendly to jsdom (it pulls workers, canvas,
// etc.), so we deliberately only exercise the lightweight outer Suspense
// shell — the part that's loaded eagerly by every consumer. The Monaco
// chunk loads asynchronously and either resolves (in a real browser) or
// stays pending (in jsdom, which is fine: we just see the fallback).

const findFallback = (container: HTMLElement, mode: `block` | `inline`) =>
    container.querySelector(mode === `block` ? `pre.CodeSnippet` : `code.CodeSnippet`);

describe(`CodeSnippet`, () => {
    it(`renders a <pre> fallback in block mode that shows the raw code`, () => {
        const { container } = render(<CodeSnippet code={`const x = 1;`} language={`typescript`} />);
        const node = findFallback(container, `block`);
        expect(node).toBeInTheDocument();
        expect(node).toHaveTextContent(`const x = 1;`);
    });

    it(`renders a <code> fallback in inline mode`, () => {
        const { container } = render(
            <CodeSnippet mode={`inline`} code={`pnpm install`} language={`text`} />
        );
        const node = findFallback(container, `inline`);
        expect(node).toBeInTheDocument();
        expect(node).toHaveTextContent(`pnpm install`);
    });

    it(`defaults to block mode when no mode prop is provided`, () => {
        const { container } = render(<CodeSnippet code={`a + b`} />);
        expect(container.querySelector(`pre.CodeSnippet`)).toBeInTheDocument();
        expect(container.querySelector(`code.CodeSnippet`)).toBeNull();
    });

    it(`forwards className and style to the rendered wrapper`, () => {
        const { container } = render(
            <CodeSnippet
                code={`x`}
                className={`my-custom-class`}
                style={{ marginTop: 12 }}
            />
        );
        const node = container.querySelector(`pre.CodeSnippet`)!;
        expect(node).toHaveClass(`my-custom-class`);
        expect(node).toHaveStyle({ marginTop: `12px` });
    });

    it(`preserves multi-line code in the block fallback`, () => {
        const code = `line one\nline two\nline three`;
        const { container } = render(<CodeSnippet code={code} />);
        const pre = container.querySelector(`pre.CodeSnippet`)!;
        expect(pre.textContent).toBe(code);
    });

    it(`renders a snippet without a MowsProvider (theme defaults apply)`, () => {
        // Sanity check: the lazy Monaco chunk only loads when a Provider is
        // present; the fallback path must render regardless so docs / static
        // sites still see the code.
        render(<CodeSnippet code={`fallback works`} />);
        expect(screen.getByText(`fallback works`)).toBeInTheDocument();
    });
});

describe(`safeColorizedHtml`, () => {
    // Belt-and-braces XSS guard around Monaco's `colorize` output. If a
    // future Monaco upgrade ever stops escaping a hostile token, the
    // helper escapes the source instead of injecting the tag.

    it(`passes through HTML that contains only span markup`, () => {
        const html = `<span class="mtk1">const</span>`;
        expect(safeColorizedHtml(html, `const`)).toBe(html);
    });

    it(`escapes the source when the produced HTML contains a script tag`, () => {
        const tainted = `<span></span><script>alert(1)</script>`;
        const source = `</span><script>alert(1)</script><span>`;
        const escaped = safeColorizedHtml(tainted, source);
        expect(escaped).not.toContain(`<script`);
        expect(escaped).toContain(`&lt;script`);
    });

    for (const tag of [`iframe`, `object`, `embed`, `link`, `meta`, `style`]) {
        it(`escapes the source when the produced HTML contains a <${tag}> tag`, () => {
            const tainted = `<${tag} foo>bar`;
            expect(safeColorizedHtml(tainted, tainted)).toContain(`&lt;${tag}`);
        });
    }
});
