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
import { logViewExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    hideToolbar: `examples-hide-toolbar`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { LogView } from "@mows/react-components";

const [lines, setLines] = useState<string[]>([]);

<LogView
    lines={lines}
    onClear={() => setLines([])}
    placeholders={{ search: "Search…", empty: "No lines yet." }}
/>`;

const COMPOSITION_SNIPPET = `// LogView is fully controlled — the consumer owns the lines array and the
// clear handler. Autoscroll is automatic when new lines are appended and the
// user is already at the bottom; scrolling up pauses autoscroll until the
// user scrolls back down.

<LogView
    lines={lines}
    onClear={() => setLines([])}
    placeholders={{ search, clear, empty }}
    hideToolbar={false}
/>`;

const PROPS: PropRow[] = [
    {
        name: `lines`,
        type: `ReadonlyArray<string>`,
        default: `—`,
        description: `Required. Log lines in arrival order. The view is purely controlled.`
    },
    {
        name: `onClear`,
        type: `() => void`,
        default: `—`,
        description: `Called when the user clicks the clear button. The clear button is hidden if this is omitted.`
    },
    {
        name: `hideToolbar`,
        type: `boolean`,
        default: `false`,
        description: `Hide the toolbar (search + clear). Useful when the surrounding chrome already supplies these controls.`
    },
    {
        name: `placeholders`,
        type: `{ search?: string; clear?: string; empty?: string }`,
        default: `—`,
        description: `Translation strings for the toolbar input placeholder, the clear button label, and the empty-state message.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<LogViewDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.logView;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.hideToolbar, label: doc.examples.hideToolbar.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/console/logView/LogView.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersAllLines,
        testFile: TEST_FILE,
        testName: `renders every line`,
        testLine: 14
    },
    {
        statement: statements.emptyPlaceholder,
        testFile: TEST_FILE,
        testName: `shows the empty placeholder when there are no lines`,
        testLine: 21
    },
    {
        statement: statements.filtersBySearch,
        testFile: TEST_FILE,
        testName: `filters lines by case-insensitive substring`,
        testLine: 26
    },
    {
        statement: statements.emptyWhenFilteredOut,
        testFile: TEST_FILE,
        testName: `shows the empty placeholder when the filter matches nothing`,
        testLine: 38
    },
    {
        statement: statements.hidesClearWhenNoCallback,
        testFile: TEST_FILE,
        testName: `hides the clear button when onClear is omitted`,
        testLine: 45
    },
    {
        statement: statements.invokesOnClear,
        testFile: TEST_FILE,
        testName: `invokes onClear when the clear button is clicked`,
        testLine: 50
    },
    {
        statement: statements.hideToolbar,
        testFile: TEST_FILE,
        testName: `hides the toolbar when hideToolbar is set`,
        testLine: 58
    },
    {
        statement: statements.reflectsLineUpdates,
        testFile: TEST_FILE,
        testName: `reflects updated lines when the prop changes`,
        testLine: 63
    }
];

export const LogViewDocPage = () => {
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
                        <ExampleCard
                            example={logViewExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.hideToolbar}
                        title={doc.examples.hideToolbar.title}
                        description={doc.examples.hideToolbar.description}
                    >
                        <ExampleCard
                            example={logViewExampleById(`hideToolbar`)}
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
                <PropTable heading={`<LogView>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default LogViewDocPage;
