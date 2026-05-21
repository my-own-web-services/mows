import * as React from "react";
import ExampleCard from "./ExampleCard";
import PageIndex, {
    type PageIndexItem
} from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import type { RegisteredExample } from "./types";

interface ExamplePageProps {
    readonly examples: ReadonlyArray<RegisteredExample>;
    /**
     * Optional prefix combined with the example id to form the DOM
     * anchor (`#${idPrefix}-${example.id}`). Defaults to "example".
     * Override when multiple example sets share the page.
     */
    readonly idPrefix?: string;
}

export const ExamplePage = ({ examples, idPrefix = `example` }: ExamplePageProps) => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<ExamplePage> must be rendered inside <MowsProvider>`);
    }
    const t = ctx.t.example;

    const indexItems: PageIndexItem[] = examples.map((example) => ({
        id: `${idPrefix}-${example.id}`,
        label: example.strings(t).title
    }));

    return (
        <div className={`flex flex-col gap-6 lg:flex-row lg:items-start`}>
            <div className={`flex flex-1 flex-col gap-6`}>
                {examples.map((example) => (
                    <ExampleCard
                        key={example.id}
                        example={example}
                        anchorId={`${idPrefix}-${example.id}`}
                    />
                ))}
            </div>
            <aside className={`lg:sticky lg:top-4 lg:w-48 lg:flex-none`}>
                <PageIndex items={indexItems} />
            </aside>
        </div>
    );
};

export default ExamplePage;
