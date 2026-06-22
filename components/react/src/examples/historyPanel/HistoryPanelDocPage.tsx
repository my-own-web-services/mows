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
import { historyPanelExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    filtered: `examples-filtered`,
    empty: `examples-empty`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { CoreActionIds } from "@my-own-web-services/react-components";

// Anywhere with access to the action manager (e.g. a button in PrimaryMenu).
actionManager.dispatchAction(CoreActionIds.OPEN_HISTORY);`;

const COMPOSITION_SNIPPET = `// HistoryPanel is registered by the lib's ModalHandler under the
// 'history' modal key, so the typical wiring is just:
//
//   <MowsProvider …>
//     <App />
//     <ModalHandler />   // already renders <HistoryPanel /> for you
//   </MowsProvider>
//
// Apps that don't use ModalHandler can render the panel inside their
// own dialog — it has no internal modal chrome.

import { Dialog, DialogContent, HistoryPanel } from "@my-own-web-services/react-components";

<Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="sm:max-w-3xl">
        <HistoryPanel />
    </DialogContent>
</Dialog>`;

const PROPS: PropRow[] = [
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
        throw new Error(`<HistoryPanelDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.historyPanel;
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
                { id: ANCHOR.filtered, label: doc.examples.filtered.title },
                { id: ANCHOR.empty, label: doc.examples.empty.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/appShell/historyPanel/HistoryPanel.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.emptyState,
        testFile: TEST_FILE,
        testName: `renders the empty state when the audit log is empty`,
        testLine: 137
    },
    {
        statement: statements.newestFirst,
        testFile: TEST_FILE,
        testName: `renders one row per audit entry, newest first`,
        testLine: 143
    },
    {
        statement: statements.searchFilters,
        testFile: TEST_FILE,
        testName: `filters by the search box`,
        testLine: 158
    },
    {
        statement: statements.undoToHereInvokes,
        testFile: TEST_FILE,
        testName: `clicking "undo to here" invokes the handler invertAction`,
        testLine: 188
    },
    {
        statement: statements.otherTabMuted,
        testFile: TEST_FILE,
        testName: `renders other-tab entries muted, with no undo button`,
        testLine: 205
    },
    {
        statement: statements.unknownActionFallback,
        testFile: TEST_FILE,
        testName: `renders entries for unknown actions with the literal id and a dimmed style`,
        testLine: 226
    },
    {
        statement: statements.clearTwoStep,
        testFile: TEST_FILE,
        testName: `clear button clears the audit log on the second click`,
        testLine: 242
    },
    {
        statement: statements.xssSafe,
        testFile: TEST_FILE,
        testName: `renders describe.params via React text — never as raw markup (XSS-safe)`,
        testLine: 263
    }
];

export const HistoryPanelDocPage = () => {
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
                            example={historyPanelExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.filtered}
                        title={doc.examples.filtered.title}
                        description={doc.examples.filtered.description}
                    >
                        <ExampleCard
                            example={historyPanelExampleById(`filtered`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.empty}
                        title={doc.examples.empty.title}
                        description={doc.examples.empty.description}
                    >
                        <ExampleCard
                            example={historyPanelExampleById(`empty`)}
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
                <PropTable heading={`<HistoryPanel>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default HistoryPanelDocPage;
