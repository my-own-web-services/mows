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
import { timezoneSelectorExampleById } from "./index";

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

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { TimezoneSelector } from "@my-own-web-services/react-components";

const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

<TimezoneSelector value={tz} onChange={setTz} />`;

const COMPOSITION_SNIPPET = `// TimezoneSelector wraps Radix Popover + cmdk Command to expose every
// IANA timezone, filterable by name + UTC offset. Selecting a value calls
// onChange with the canonical IANA id (e.g. "Europe/Berlin").

<TimezoneSelector value={tz} onChange={setTz} />`;

const PROPS: PropRow[] = [
    { name: `value`, type: `string | undefined`, default: `—`, description: `Required. The currently-selected IANA timezone (e.g. "Europe/Berlin").` },
    { name: `onChange`, type: `(timezone: string) => void`, default: `—`, description: `Required. Fires with the chosen IANA id when the user picks one.` },
    { name: `placeholder`, type: `string`, default: `auto`, description: `Trigger placeholder when value is empty.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the trigger.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the trigger.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<TimezoneSelectorDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.timezoneSelector;
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

const TEST_FILE = `lib/components/dateTime/dateTimePicker/TimezoneSelector.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersTrigger, testFile: TEST_FILE, testName: `renders the trigger button`, testLine: 9 },
    { statement: statements.showsSelected, testFile: TEST_FILE, testName: `shows the selected timezone on the trigger`, testLine: 14 },
    { statement: statements.opensSearch, testFile: TEST_FILE, testName: `opens a search list when the trigger is clicked`, testLine: 19 },
    { statement: statements.firesOnChange, testFile: TEST_FILE, testName: `fires onChange when the user picks a timezone`, testLine: 28 },
    { statement: statements.fullyControllable, testFile: TEST_FILE, testName: `is fully controllable via value + onChange`, testLine: 42 },
    { statement: statements.disabledNoOpen, testFile: TEST_FILE, testName: `disabled prevents opening the popover`, testLine: 62 }
];

export const TimezoneSelectorDocPage = () => {
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
                        <ExampleCard example={timezoneSelectorExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<TimezoneSelector>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default TimezoneSelectorDocPage;
