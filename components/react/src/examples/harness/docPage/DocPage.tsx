import * as React from "react";
import PageIndex, {
    type PageIndexItem
} from "../../../../lib/components/navigation/pageIndex/PageIndex";

interface DocPageProps {
    /** Page index items rendered in the sticky right rail. */
    readonly indexItems: ReadonlyArray<PageIndexItem>;
    /** The doc page content — typically a sequence of `<DocSection>`s. */
    readonly children: React.ReactNode;
}

/**
 * Top-level shell for a component documentation page. Lays out the
 * content stack on the left and a sticky `<PageIndex>` on the right.
 *
 * Top-level sections inside `children` are separated by `gap-16` and
 * `<DocSection>` adds its own vertical rhythm — this enforces the
 * consistent spacing required for every doc page (see CLAUDE.md ›
 * "Doc pages" requirements).
 */
export const DocPage = ({ indexItems, children }: DocPageProps) => (
    <div className={`flex gap-16 lg:items-start`}>
        <div className={`flex flex-1 flex-col gap-16`}>{children}</div>
        <aside className={`lg:sticky lg:top-4 lg:w-56 lg:flex-none`}>
            <PageIndex items={indexItems} />
        </aside>
    </div>
);
