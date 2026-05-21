import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandBlock } from "./CommandBlock";

describe(`CommandBlock`, () => {
    it(`renders the command body for the default pnpm package manager`, () => {
        const { container } = render(<CommandBlock command={`add some-pkg`} />);
        expect(container.textContent).toContain(`pnpm add some-pkg`);
    });

    it(`is themed via semantic tokens (no literal neutral palette colours)`, () => {
        // Regression guard for the "install block stays dark in light mode"
        // bug. The block must theme via bg-card / bg-muted / bg-accent /
        // border-border / text-foreground — never via bg-zinc-* / bg-gray-*
        // / etc. The ESLint no-restricted-syntax rule covers source, this
        // test covers the rendered DOM in case someone smuggles a class
        // string in at runtime.
        const { container } = render(<CommandBlock command={`add some-pkg`} />);
        const html = container.innerHTML;
        expect(html).not.toMatch(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|accent|caret|divide|shadow)-(?:zinc|gray|slate|neutral|stone)-\d+/);
        // Sanity-check: at least one semantic token is in use.
        expect(html).toMatch(/\b(?:bg-card|bg-muted|text-foreground|border-border)\b/);
    });
});
