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
import { dateTimePickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    withTimezone: `examples-with-timezone`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { DateTimePicker } from "mows-components-react";

const [value, setValue] = useState<Date | undefined>(new Date());

<DateTimePicker value={value} onChange={setValue} />`;

const COMPOSITION_SNIPPET = `// Combine the text input + calendar popover + time picker. Set showSeconds
// for a second column; showTimezone for the IANA timezone selector.

<DateTimePicker
    value={value}
    onChange={setValue}
    timeFormat="24h"
    showSeconds
    showTimezone
    timeZone={tz}
    onTimezoneChange={setTz}
    disableFuture       // optional — disable dates after today
    timeLayout="beside" // optional — put time picker next to the calendar
/>`;

const PROPS: PropRow[] = [
    { name: `value`, type: `Date`, default: `—`, description: `Controlled date value. Pair with onChange.` },
    { name: `defaultValue`, type: `Date`, default: `—`, description: `Initial value in uncontrolled mode.` },
    { name: `onChange`, type: `(date: Date | undefined) => void`, default: `—`, description: `Fires when the date changes.` },
    { name: `timeFormat`, type: `"12h" | "24h"`, default: `auto-detected`, description: `Time display format. Defaults to the user's locale preference.` },
    { name: `showSeconds`, type: `boolean`, default: `false`, description: `Show a seconds column in the time picker.` },
    { name: `showTimezone`, type: `boolean`, default: `false`, description: `Show the timezone selector inside the popover.` },
    { name: `timeZone`, type: `string`, default: `—`, description: `IANA timezone (e.g. "Europe/Berlin"). Used when showTimezone is set.` },
    { name: `onTimezoneChange`, type: `(tz: string) => void`, default: `—`, description: `Fires when the user changes the timezone.` },
    { name: `timeLayout`, type: `"below" | "beside"`, default: `"below"`, description: `Position of the time picker relative to the calendar.` },
    { name: `placeholder`, type: `string`, default: `auto`, description: `Custom placeholder. Default reflects timeFormat + showSeconds.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the entire picker.` },
    { name: `disableFuture`, type: `boolean`, default: `false`, description: `Disable dates after today (date-of-birth pickers).` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<DateTimePickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.dateTimePicker;
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
                { id: ANCHOR.withTimezone, label: doc.examples.withTimezone.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/dateTime/dateTimePicker/DateTimePicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersTextInput, testFile: TEST_FILE, testName: `renders a date+time input`, testLine: 9 },
    { statement: statements.seedsFromDefault, testFile: TEST_FILE, testName: `uses defaultValue to seed the displayed value`, testLine: 14 },
    { statement: statements.reflectsControlled, testFile: TEST_FILE, testName: `reflects a controlled value prop`, testLine: 22 },
    { statement: statements.firesOnConfirm, testFile: TEST_FILE, testName: `fires onChange when the user edits the text input and confirms`, testLine: 31 },
    { statement: statements.disabledForwards, testFile: TEST_FILE, testName: `renders disabled when disabled is set`, testLine: 53 },
    { statement: statements.placeholderReflectsFormat, testFile: TEST_FILE, testName: `exposes a placeholder reflecting the time format / seconds`, testLine: 58 },
    { statement: statements.showsTimezoneSelector, testFile: TEST_FILE, testName: `shows the timezone selector when showTimezone is set`, testLine: 65 }
];

export const DateTimePickerDocPage = () => {
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
                        <ExampleCard example={dateTimePickerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.withTimezone}
                        title={doc.examples.withTimezone.title}
                        description={doc.examples.withTimezone.description}
                    >
                        <ExampleCard example={dateTimePickerExampleById(`withTimezone`)} hideHeader />
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
                <PropTable heading={`<DateTimePicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default DateTimePickerDocPage;
