import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import baseEn from "../../../lib/languages/en-US/default";
import { MowsContext, type MowsContextType } from "../../../lib/mowsContext/MowsContext";
import ExpandableCode from "./ExpandableCode";

const mowsContext = { t: baseEn } as unknown as MowsContextType;

const wrap = (children: ReactNode) =>
    <MowsContext.Provider value={mowsContext}>{children}</MowsContext.Provider>;

// jsdom returns 0 for scrollHeight by default. Stub it per-element via
// Object.defineProperty so we can drive the "needs expand" path without
// real layout.
const stubScrollHeight = (height: number) => {
    Object.defineProperty(HTMLElement.prototype, `scrollHeight`, {
        configurable: true,
        get() {
            return height;
        }
    });
};

const restoreScrollHeight = () => {
    // Re-establish jsdom's default 0 value.
    Object.defineProperty(HTMLElement.prototype, `scrollHeight`, {
        configurable: true,
        get() {
            return 0;
        }
    });
};

describe(`ExpandableCode`, () => {
    it(`renders the children verbatim`, () => {
        restoreScrollHeight();
        render(
            wrap(
                <ExpandableCode>
                    <pre>my content</pre>
                </ExpandableCode>
            )
        );
        expect(screen.getByText(`my content`)).toBeInTheDocument();
    });

    it(`hides the Expand button when content fits within collapsedHeight`, () => {
        restoreScrollHeight();
        render(
            wrap(
                <ExpandableCode collapsedHeight={500}>
                    <div style={{ height: 100 }}>short</div>
                </ExpandableCode>
            )
        );
        expect(screen.queryByRole(`button`)).toBeNull();
    });

    it(`shows the Expand button when content exceeds collapsedHeight`, () => {
        stubScrollHeight(800);
        render(
            wrap(
                <ExpandableCode collapsedHeight={200}>
                    <div>tall</div>
                </ExpandableCode>
            )
        );
        const btn = screen.getByRole(`button`);
        expect(btn).toHaveTextContent(/Expand/i);
        restoreScrollHeight();
    });

    it(`toggles between Expand and Collapse labels`, async () => {
        const user = userEvent.setup();
        stubScrollHeight(800);
        render(
            wrap(
                <ExpandableCode collapsedHeight={200}>
                    <div>tall</div>
                </ExpandableCode>
            )
        );
        const btn = screen.getByRole(`button`);
        expect(btn).toHaveTextContent(/Expand/i);
        await user.click(btn);
        expect(screen.getByRole(`button`)).toHaveTextContent(/Collapse/i);
        restoreScrollHeight();
    });

    it(`honours defaultExpanded`, () => {
        stubScrollHeight(800);
        render(
            wrap(
                <ExpandableCode collapsedHeight={200} defaultExpanded>
                    <div>tall</div>
                </ExpandableCode>
            )
        );
        expect(screen.getByRole(`button`)).toHaveTextContent(/Collapse/i);
        restoreScrollHeight();
    });

    it(`honours expandLabel / collapseLabel overrides`, async () => {
        const user = userEvent.setup();
        stubScrollHeight(800);
        render(
            wrap(
                <ExpandableCode
                    collapsedHeight={200}
                    expandLabel={`Show more`}
                    collapseLabel={`Show less`}
                >
                    <div>tall</div>
                </ExpandableCode>
            )
        );
        expect(screen.getByRole(`button`)).toHaveTextContent(`Show more`);
        await user.click(screen.getByRole(`button`));
        expect(screen.getByRole(`button`)).toHaveTextContent(`Show less`);
        restoreScrollHeight();
    });
});
