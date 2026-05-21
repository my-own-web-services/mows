import * as React from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { CommandBlock } from "../harness/docPage/CommandBlock";
import { ExampleCard } from "../harness/ExampleCard";
import {
    BehaviourList,
    type BehaviourEntry,
    DocPage,
    DocSection,
    DocSubsection,
    InstallationTabs,
    ManualStep,
    ManualSteps,
    PropTable,
    type PropRow
} from "../harness/docPage";
import { codeSnippetExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    block: `examples-block`,
    inline: `examples-inline`,
    languages: `examples-languages`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { CodeSnippet } from "mows-components-react";

<CodeSnippet code="const x = 1;" language="typescript" />

<CodeSnippet code="aria-current" mode="inline" />`;

const COMPOSITION_SNIPPET = `// Block: stand-alone snippet with token coloring
<CodeSnippet
    code={\`const greet = (name: string) => "hi " + name;\`}
    language="typescript"
/>

// Inline: a chip inside a sentence
<p>
    Pass {" "}
    <CodeSnippet code='mode="selection"' mode="inline" />
    {" "} to switch the stepper into a picker.
</p>`;

const CODE_SNIPPET_PROPS: PropRow[] = [
    {
        name: `code`,
        type: `string`,
        default: `(required)`,
        description: `The code to render. Trimmed at the edges in inline mode.`
    },
    {
        name: `language`,
        type: `CodeViewerLanguage`,
        default: `"text"`,
        description: `Monaco language id (json / yaml / javascript / typescript / jsx / tsx / text).`
    },
    {
        name: `mode`,
        type: `"block" | "inline"`,
        default: `"block"`,
        description: `block wraps in <pre> with its own visual block. inline wraps in a <code>-style chip and collapses newlines.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the rendered wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Extra inline styles on the rendered wrapper.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<CodeSnippetDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.codeSnippet;
};

type CodeSnippetStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: CodeSnippetStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.block, label: doc.examples.block.title },
                { id: ANCHOR.inline, label: doc.examples.inline.title },
                { id: ANCHOR.languages, label: doc.examples.languages.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/code/codeSnippet/CodeSnippet.test.tsx`;

const buildBehaviourEntries = (
    statements: CodeSnippetStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.blockFallback,
        testFile: TEST_FILE,
        testName: `renders a <pre> fallback in block mode that shows the raw code`,
        testLine: 17
    },
    {
        statement: statements.inlineFallback,
        testFile: TEST_FILE,
        testName: `renders a <code> fallback in inline mode`,
        testLine: 24
    },
    {
        statement: statements.defaultMode,
        testFile: TEST_FILE,
        testName: `defaults to block mode when no mode prop is provided`,
        testLine: 33
    },
    {
        statement: statements.forwardsClassName,
        testFile: TEST_FILE,
        testName: `forwards className and style to the rendered wrapper`,
        testLine: 39
    },
    {
        statement: statements.preservesMultiline,
        testFile: TEST_FILE,
        testName: `preserves multi-line code in the block fallback`,
        testLine: 52
    },
    {
        statement: statements.rendersWithoutProvider,
        testFile: TEST_FILE,
        testName: `renders a snippet without a MowsProvider (theme defaults apply)`,
        testLine: 59
    }
];

export const CodeSnippetDocPage = () => {
    const t = useDocStrings();
    const doc = t.doc;
    const indexItems = React.useMemo(() => buildIndexItems(t), [t]);
    const behaviourEntries = React.useMemo(
        () => buildBehaviourEntries(doc.definedBehaviour.statements),
        [doc.definedBehaviour.statements]
    );

    return (
        <DocPage indexItems={indexItems}>
            <DocSection id={ANCHOR.installation} title={doc.installation.title}>
                <InstallationTabs
                    commandTabLabel={doc.installation.commandTab}
                    manualTabLabel={doc.installation.manualTab}
                    command={PACKAGE_INSTALL}
                    manual={
                        <ManualSteps>
                            <ManualStep stepNumber={1}>
                                <p className={`text-sm`}>{doc.installation.manualStep1}</p>
                                <CommandBlock command={PACKAGE_INSTALL} />
                            </ManualStep>
                            <ManualStep stepNumber={2}>
                                <p className={`text-sm`}>{doc.installation.manualStep2}</p>
                                <ExpandableCode>
                                    <CodeViewer
                                        code={USAGE_SNIPPET}
                                        language={`tsx`}
                                        fitContent
                                    />
                                </ExpandableCode>
                            </ManualStep>
                            <ManualStep stepNumber={3} isLast>
                                <p className={`text-sm`}>{doc.installation.manualStep3}</p>
                            </ManualStep>
                        </ManualSteps>
                    }
                />
            </DocSection>

            <DocSection id={ANCHOR.examples} title={doc.examples.title}>
                <div className={`flex flex-col gap-10`}>
                    <DocSubsection
                        id={ANCHOR.block}
                        title={doc.examples.block.title}
                        description={doc.examples.block.description}
                    >
                        <ExampleCard example={codeSnippetExampleById(`block`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.inline}
                        title={doc.examples.inline.title}
                        description={doc.examples.inline.description}
                    >
                        <ExampleCard example={codeSnippetExampleById(`inline`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.languages}
                        title={doc.examples.languages.title}
                        description={doc.examples.languages.description}
                    >
                        <ExampleCard example={codeSnippetExampleById(`languages`)} hideHeader />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection
                id={ANCHOR.usage}
                title={doc.usage.title}
                description={doc.usage.body}
            >
                <ExpandableCode>
                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection
                id={ANCHOR.composition}
                title={doc.composition.title}
                description={doc.composition.body}
            >
                <ExpandableCode>
                    <CodeViewer code={COMPOSITION_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection
                id={ANCHOR.rtl}
                title={doc.rtl.title}
                description={doc.rtl.body}
            />

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList
                    entries={behaviourEntries}
                    verifiedByLabel={doc.definedBehaviour.verifiedBy}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.apiReference}
                title={doc.apiReference.title}
                description={doc.apiReference.intro}
            >
                <PropTable heading={`<CodeSnippet>`} rows={CODE_SNIPPET_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CodeSnippetDocPage;
