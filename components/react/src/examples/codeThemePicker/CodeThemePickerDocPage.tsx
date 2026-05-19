import * as React from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { CommandBlock } from "../harness/CommandBlock";
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
import { codeThemePickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    popover: `examples-popover`,
    standalone: `examples-standalone`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { CodeThemePicker } from "mows-components-react";

<CodeThemePicker />`;

const COMPOSITION_SNIPPET = `// Inside <MowsProvider> the picker reads/writes the active code theme.
// Set standalone to skip the popover trigger and inline the search list.

<CodeThemePicker standalone />`;

const PICKER_PROPS: PropRow[] = [
    {
        name: `defaultOpen`,
        type: `boolean`,
        default: `false`,
        description: `Open the popover on first mount (only in non-standalone form).`
    },
    {
        name: `onValueChange`,
        type: `(value?: MowsCodeTheme) => void`,
        default: `—`,
        description: `Called with the newly selected theme. The picker also calls setCodeTheme on the surrounding MowsContext.`
    },
    {
        name: `standalone`,
        type: `boolean`,
        default: `false`,
        description: `Skip the popover trigger and render the search + list inline.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the wrapper.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<CodeThemePickerDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.codeThemePicker;
};

type CodeThemePickerStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: CodeThemePickerStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.popover, label: doc.examples.popover.title },
                { id: ANCHOR.standalone, label: doc.examples.standalone.title }
            ]
        },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/code/codeThemePicker/CodeThemePicker.test.tsx`;

const buildBehaviourEntries = (
    statements: CodeThemePickerStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.showsCurrent,
        testFile: TEST_FILE,
        testName: `shows the current code theme name`,
        testLine: 70
    },
    {
        statement: statements.listsAll,
        testFile: TEST_FILE,
        testName: `lists all theme options when opened (standalone)`,
        testLine: 75
    },
    {
        statement: statements.callsSetCodeTheme,
        testFile: TEST_FILE,
        testName: `calls setCodeTheme with the selected theme`,
        testLine: 83
    },
    {
        statement: statements.filtersBySearch,
        testFile: TEST_FILE,
        testName: `filters themes by search`,
        testLine: 94
    }
];

export const CodeThemePickerDocPage = () => {
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
                            <ManualStep n={1}>
                                <p className={`text-sm`}>{doc.installation.manualStep1}</p>
                                <CommandBlock command={PACKAGE_INSTALL} />
                            </ManualStep>
                            <ManualStep n={2}>
                                <p className={`text-sm`}>{doc.installation.manualStep2}</p>
                                <ExpandableCode>
                                    <CodeViewer
                                        code={USAGE_SNIPPET}
                                        language={`tsx`}
                                        fitContent
                                    />
                                </ExpandableCode>
                            </ManualStep>
                            <ManualStep n={3} isLast>
                                <p className={`text-sm`}>{doc.installation.manualStep3}</p>
                            </ManualStep>
                        </ManualSteps>
                    }
                />
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

            <DocSection id={ANCHOR.examples} title={doc.examples.title}>
                <div className={`flex flex-col gap-10`}>
                    <DocSubsection
                        id={ANCHOR.popover}
                        title={doc.examples.popover.title}
                        description={doc.examples.popover.description}
                    >
                        <ExampleCard
                            example={codeThemePickerExampleById(`popover`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.standalone}
                        title={doc.examples.standalone.title}
                        description={doc.examples.standalone.description}
                    >
                        <ExampleCard
                            example={codeThemePickerExampleById(`standalone`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
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
                <PropTable heading={`<CodeThemePicker>`} rows={PICKER_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CodeThemePickerDocPage;
