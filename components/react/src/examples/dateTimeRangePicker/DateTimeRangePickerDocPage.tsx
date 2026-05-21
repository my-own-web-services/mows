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
import { dateTimeRangePickerExampleById } from "./index";

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

const USAGE_SNIPPET = `import { DateTimeRangePicker } from "mows-components-react";

const [range, setRange] = useState<DateTimeRange>({ from: new Date(), to: undefined });

<DateTimeRangePicker value={range} onChange={setRange} />`;

const COMPOSITION_SNIPPET = `// Two date+time inputs sharing one calendar popover. Click a day to set
// the start; click another to set the end; drag either endpoint of an
// existing range to adjust it.

<DateTimeRangePicker
    value={range}
    onChange={setRange}
    timeFormat="24h"
    showSeconds
    showTimezone
    timeZone={tz}
    onTimezoneChange={setTz}
    timeLayout="beside"
    disableFuture       // optional
    showDuration        // shows "5 days 6h 30m" in the popover
/>`;

const PROPS: PropRow[] = [
    { name: `value`, type: `DateTimeRange`, default: `—`, description: `Controlled range. Pair with onChange.` },
    { name: `defaultValue`, type: `DateTimeRange`, default: `—`, description: `Initial range in uncontrolled mode.` },
    { name: `onChange`, type: `(range: DateTimeRange) => void`, default: `—`, description: `Fires whenever from or to changes.` },
    { name: `timeFormat`, type: `"12h" | "24h"`, default: `auto`, description: `Time format. Defaults to the user's locale.` },
    { name: `showSeconds`, type: `boolean`, default: `false`, description: `Show seconds in the time pickers.` },
    { name: `showTimezone`, type: `boolean`, default: `false`, description: `Render the timezone selector inside the popover.` },
    { name: `timeZone`, type: `string`, default: `—`, description: `IANA timezone (e.g. "America/New_York").` },
    { name: `onTimezoneChange`, type: `(tz: string) => void`, default: `—`, description: `Fires when the user changes the timezone.` },
    { name: `timeLayout`, type: `"below" | "beside"`, default: `"below"`, description: `Where the time pickers sit relative to the calendar.` },
    { name: `startPlaceholder`, type: `string`, default: `auto`, description: `Placeholder for the start input.` },
    { name: `endPlaceholder`, type: `string`, default: `auto`, description: `Placeholder for the end input.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the entire picker.` },
    { name: `disableFuture`, type: `boolean`, default: `false`, description: `Disable dates after today.` },
    { name: `showDuration`, type: `boolean`, default: `false`, description: `Render the computed duration ("5 days 6h 30m") inside the popover.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<DateTimeRangePickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.dateTimeRangePicker;
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

const TEST_FILE = `lib/components/dateTime/dateTimeRangePicker/DateTimeRangePicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersBothInputs, testFile: TEST_FILE, testName: `renders two text inputs: start and end`, testLine: 15 },
    { statement: statements.reflectsFrom, testFile: TEST_FILE, testName: `reflects defaultValue.from on the start input`, testLine: 21 },
    { statement: statements.reflectsTo, testFile: TEST_FILE, testName: `reflects defaultValue.to on the end input`, testLine: 28 },
    { statement: statements.fullyControllable, testFile: TEST_FILE, testName: `is fully controllable via value + onChange`, testLine: 35 },
    { statement: statements.disabledForwards, testFile: TEST_FILE, testName: `disables both inputs when disabled is set`, testLine: 51 }
];

export const DateTimeRangePickerDocPage = () => {
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
                        <ExampleCard example={dateTimeRangePickerExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<DateTimeRangePicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default DateTimeRangePickerDocPage;
