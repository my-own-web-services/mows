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
import { timePickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    twelveHour: `examples-twelve-hour`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { TimePicker } from "@my-own-web-services/react-components";

const [date, setDate] = useState(new Date());

<TimePicker date={date} onChange={setDate} timeFormat="24h" showSeconds />`;

const COMPOSITION_SNIPPET = `// TimePicker is the inner scroller-column control used by <DateTimePicker>.
// The hour column varies with timeFormat (24 entries in 24h, 12 entries
// + AM/PM column in 12h). showSeconds adds the seconds column.

<TimePicker date={date} onChange={setDate} timeFormat="12h" />`;

const PROPS: PropRow[] = [
    { name: `date`, type: `Date | undefined`, default: `—`, description: `Required. Source date — time is read off this value.` },
    { name: `onChange`, type: `(date: Date) => void`, default: `—`, description: `Required. Fires with a new Date when the user picks an hour / minute / second / AM-PM.` },
    { name: `timeFormat`, type: `"12h" | "24h"`, default: `—`, description: `Required. 12h mode renders 12 hour entries + AM/PM column.` },
    { name: `showSeconds`, type: `boolean`, default: `—`, description: `Required. Show a seconds column.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Advisory — the inner cells do not yet forward disabled.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<TimePickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.timePicker;
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
                { id: ANCHOR.twelveHour, label: doc.examples.twelveHour.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/dateTime/dateTimePicker/TimePicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersColumns24h, testFile: TEST_FILE, testName: `renders an hours column and a minutes column in 24h mode`, testLine: 11 },
    { statement: statements.secondsColumn, testFile: TEST_FILE, testName: `renders a seconds column when showSeconds is set`, testLine: 25 },
    { statement: statements.firesOnHourPick, testFile: TEST_FILE, testName: `fires onChange with a new Date when an hour cell is picked`, testLine: 42 },
    { statement: statements.fullyControllable, testFile: TEST_FILE, testName: `is fully controllable via date + onChange`, testLine: 63 },
    { statement: statements.amPmColumn, testFile: TEST_FILE, testName: `renders an AM/PM column in 12h mode`, testLine: 84 }
];

export const TimePickerDocPage = () => {
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
                        <ExampleCard example={timePickerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.twelveHour}
                        title={doc.examples.twelveHour.title}
                        description={doc.examples.twelveHour.description}
                    >
                        <ExampleCard example={timePickerExampleById(`twelveHour`)} hideHeader />
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
                <PropTable heading={`<TimePicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default TimePickerDocPage;
