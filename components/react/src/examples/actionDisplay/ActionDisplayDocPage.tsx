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
import { actionDisplayExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { ActionDisplay } from "mows-components-react";

const action = mowsContext.actionManager.getAction("myAction");

{action && <ActionDisplay action={action} />}`;

const COMPOSITION_SNIPPET = `// ActionDisplay reads its label from MowsContext.t.actions[action.id]
// and its hotkeys from MowsContext.hotkeyManager. Mount inside a
// <MowsProvider> with the matching action registered.

<ActionDisplay action={action} />

// Custom rendering: if the action handler supplies a component() in its
// state, ActionDisplay renders that instead of the icon + label.`;

const PROPS: PropRow[] = [
    { name: `action`, type: `Action`, default: `—`, description: `Required. The Action instance to render. Get it from actionManager.getAction(id).` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer span.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer span.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<ActionDisplayDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.actionDisplay;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [{ id: ANCHOR.default, label: doc.examples.default.title }]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/actions/actionDisplay/ActionDisplay.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.translatesLabel, testFile: TEST_FILE, testName: `renders the action label from the translation table`, testLine: 87 },
    { statement: statements.fallsBackToId, testFile: TEST_FILE, testName: `falls back to the action id when no translation is registered`, testLine: 97 },
    { statement: statements.rendersIcon, testFile: TEST_FILE, testName: `renders the icon returned by the action state`, testLine: 111 },
    { statement: statements.exposesDisabledReason, testFile: TEST_FILE, testName: `exposes disabledReasonText via the title attribute`, testLine: 121 },
    { statement: statements.rendersHotkeys, testFile: TEST_FILE, testName: `renders one KeyComboDisplay per registered hotkey`, testLine: 132 }
];

export const ActionDisplayDocPage = () => {
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
                                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
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
                        <ExampleCard example={actionDisplayExampleById(`default`)} hideHeader />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.usage} title={doc.usage.title} description={doc.usage.body}>
                <ExpandableCode>
                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection id={ANCHOR.composition} title={doc.composition.title} description={doc.composition.body}>
                <ExpandableCode>
                    <CodeViewer code={COMPOSITION_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body} />

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList entries={behaviourEntries} verifiedByLabel={doc.definedBehaviour.verifiedBy} />
            </DocSection>

            <DocSection id={ANCHOR.apiReference} title={doc.apiReference.title} description={doc.apiReference.intro}>
                <PropTable heading={`<ActionDisplay>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ActionDisplayDocPage;
