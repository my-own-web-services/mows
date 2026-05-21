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
import { themePickerExampleById } from "./index";

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

const USAGE_SNIPPET = `import { ThemePicker } from "mows-components-react";

<ThemePicker />`;

const COMPOSITION_SNIPPET = `// ThemePicker reads the available themes and the current theme from
// MowsProvider, and calls setTheme on selection. The "system" entry
// adds a "(dark)" / "(light)" suffix in the popover row reflecting the
// resolved OS preference. Set standalone to inline the searchable list.

<ThemePicker standalone />`;

const PROPS: PropRow[] = [
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Open the popover on first mount (popover mode only).` },
    { name: `onValueChange`, type: `(value?: MowsTheme) => void`, default: `—`, description: `Called with the selected theme; also called with undefined when the popover closes without a selection.` },
    { name: `standalone`, type: `boolean`, default: `false`, description: `Skip the popover trigger and render the searchable list inline.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<ThemePickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.themePicker;
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
                { id: ANCHOR.popover, label: doc.examples.popover.title },
                { id: ANCHOR.standalone, label: doc.examples.standalone.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/settings/themePicker/ThemePicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.listsThemes, testFile: TEST_FILE, testName: `lists every theme in standalone mode`, testLine: 73 },
    { statement: statements.firesSetTheme, testFile: TEST_FILE, testName: `fires setTheme on the surrounding context when a theme is picked`, testLine: 84 },
    { statement: statements.popoverShowsCurrent, testFile: TEST_FILE, testName: `renders the popover trigger with the current theme by default`, testLine: 96 }
];

export const ThemePickerDocPage = () => {
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
                        id={ANCHOR.popover}
                        title={doc.examples.popover.title}
                        description={doc.examples.popover.description}
                    >
                        <ExampleCard example={themePickerExampleById(`popover`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.standalone}
                        title={doc.examples.standalone.title}
                        description={doc.examples.standalone.description}
                    >
                        <ExampleCard example={themePickerExampleById(`standalone`)} hideHeader />
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
                <PropTable heading={`<ThemePicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ThemePickerDocPage;
