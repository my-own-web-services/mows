import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../lib/components/ui/tabs";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { cleanExampleSource } from "./cleanExampleSource";
import { serializeState } from "./serializeState";
import { ExampleStateProvider } from "./useExampleState";
import type { RegisteredExample } from "./types";

interface ExampleCardProps {
    readonly example: RegisteredExample;
    /**
     * DOM id placed on the outer container so anchor navigation (e.g.
     * the surrounding `<PageIndex>`) can scroll to this example. When
     * omitted no id is rendered.
     */
    readonly anchorId?: string;
    /**
     * Suppress the title + description block. Use when the surrounding
     * doc page already provides a section heading above the example;
     * rendering both would be redundant.
     */
    readonly hideHeader?: boolean;
}

const STATE_NOT_REPORTED = Symbol(`state-not-reported`);

export const ExampleCard = ({ example, anchorId, hideHeader }: ExampleCardProps) => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<ExampleCard> must be rendered inside <MowsProvider>`);
    }
    const t = ctx.t.example;
    const harness = t.examples._harness;
    const { title, description } = example.strings(t);

    const [state, setState] = React.useState<unknown>(STATE_NOT_REPORTED);

    const cleanedSource = React.useMemo(
        () => cleanExampleSource(example.source),
        [example.source]
    );

    const stateText =
        state === STATE_NOT_REPORTED ? harness.noStateReported : serializeState(state);

    const Example = example.Example;

    // No outer Card — the preview region below already provides a bordered
    // boundary, and wrapping that in another Card produced a visible
    // card-in-card. The container is just a flex column.
    return (
        <div id={anchorId} className={`flex scroll-mt-20 flex-col gap-4`}>
            {!hideHeader && (
                <div className={`flex flex-col gap-1.5`}>
                    <h3 className={`text-lg leading-none font-semibold`}>{title}</h3>
                    <p className={`text-sm text-muted-foreground`}>{description}</p>
                </div>
            )}
            <div className={`rounded-md border bg-card p-6`}>
                <ExampleStateProvider onChange={setState}>
                    <Example />
                </ExampleStateProvider>
            </div>
            <Tabs defaultValue={`code`}>
                <TabsList>
                    <TabsTrigger value={`code`}>{harness.codeTab}</TabsTrigger>
                    <TabsTrigger value={`state`}>{harness.stateTab}</TabsTrigger>
                </TabsList>
                <TabsContent value={`code`} className={`mt-3`}>
                    <ExpandableCode>
                        <CodeViewer code={cleanedSource} language={`tsx`} fitContent />
                    </ExpandableCode>
                </TabsContent>
                <TabsContent value={`state`} className={`mt-3`}>
                    <ExpandableCode>
                        <CodeViewer
                            code={stateText}
                            language={state === STATE_NOT_REPORTED ? `text` : `json`}
                            fitContent
                        />
                    </ExpandableCode>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ExampleCard;
