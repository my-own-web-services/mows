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
import { codeViewerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    editable: `examples-editable`,
    fitContent: `examples-fit-content`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { CodeViewer } from "@mows/react-components";

<CodeViewer
    code={'const x = 1;\\nconsole.log(x);'}
    language="typescript"
/>`;

const COMPOSITION_SNIPPET = `// Editable variant: bind onCodeChange to receive edits
const [code, setCode] = useState("{}");

<CodeViewer
    code={code}
    language="json"
    editable
    onCodeChange={setCode}
/>

// fitContent + ExpandableCode for shadcn-docs-style snippets
<ExpandableCode>
    <CodeViewer code={snippet} language="tsx" fitContent />
</ExpandableCode>`;

const CODE_VIEWER_PROPS: PropRow[] = [
    {
        name: `code`,
        type: `string`,
        default: `(required)`,
        description: `The code to render.`
    },
    {
        name: `language`,
        type: `CodeViewerLanguage`,
        default: `"text"`,
        description: `Monaco language id (json / yaml / javascript / typescript / jsx / tsx / text).`
    },
    {
        name: `showLineNumbers`,
        type: `boolean`,
        default: `t.codeEditorSettings.showLineNumbers ?? true`,
        description: `Render the line-number gutter.`
    },
    {
        name: `wrap`,
        type: `boolean`,
        default: `t.codeEditorSettings.wrap ?? true`,
        description: `Wrap long lines instead of horizontal scroll.`
    },
    {
        name: `showWhitespace`,
        type: `boolean`,
        default: `t.codeEditorSettings.showWhitespace ?? true`,
        description: `Render dot/arrow markers for spaces and tabs.`
    },
    {
        name: `editable`,
        type: `boolean`,
        default: `false`,
        description: `Enables typing, undo/redo, folding, line-highlight.`
    },
    {
        name: `onCodeChange`,
        type: `(next: string) => void`,
        default: `—`,
        description: `Called with the new value when the user edits.`
    },
    {
        name: `fitContent`,
        type: `boolean`,
        default: `false`,
        description: `Wrapper sizes to Monaco's content height; no internal scrollbar.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the wrapper (overrides the default h-[260px]).`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Extra inline styles on the wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<CodeViewerDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.codeViewer;
};

type CodeViewerStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: CodeViewerStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.editable, label: doc.examples.editable.title },
                { id: ANCHOR.fitContent, label: doc.examples.fitContent.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/code/codeViewer/CodeViewer.test.tsx`;

const buildBehaviourEntries = (
    statements: CodeViewerStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersLazyEditor,
        testFile: TEST_FILE,
        testName: `renders the lazy-loaded editor with the supplied code`,
        testLine: 20
    },
    {
        statement: statements.forwardsClassName,
        testFile: TEST_FILE,
        testName: `forwards className to the editor wrapper`,
        testLine: 27
    }
];

export const CodeViewerDocPage = () => {
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
                        id={ANCHOR.default}
                        title={doc.examples.default.title}
                        description={doc.examples.default.description}
                    >
                        <ExampleCard example={codeViewerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.editable}
                        title={doc.examples.editable.title}
                        description={doc.examples.editable.description}
                    >
                        <ExampleCard example={codeViewerExampleById(`editable`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.fitContent}
                        title={doc.examples.fitContent.title}
                        description={doc.examples.fitContent.description}
                    >
                        <ExampleCard
                            example={codeViewerExampleById(`fitContent`)}
                            hideHeader
                        />
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
                <PropTable heading={`<CodeViewer>`} rows={CODE_VIEWER_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CodeViewerDocPage;
