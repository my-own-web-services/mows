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
import { calendarExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    disableFuture: `examples-disable-future`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Calendar } from "@my-own-web-services/react-components";

const [date, setDate] = useState<Date | undefined>(new Date());

<Calendar
    mode="single"
    selected={date}
    onSelect={setDate}
    className="rounded-md border"
/>`;

const COMPOSITION_SNIPPET = `// Calendar wraps react-day-picker with shadcn styling. Pass disableFuture
// to disable every day after today (useful for date-of-birth pickers).

<Calendar
    mode="single"
    selected={date}
    onSelect={setDate}
    disableFuture
    showOutsideDays
/>

// Caption layout = "dropdown" gives clickable month + year selectors:
<Calendar mode="single" captionLayout="dropdown" />`;

const PROPS: PropRow[] = [
    {
        name: `mode`,
        type: `"single" | "multiple" | "range"`,
        default: `—`,
        description: `Selection mode. Maps onto the react-day-picker mode prop.`
    },
    {
        name: `selected`,
        type: `Date | Date[] | DateRange | undefined`,
        default: `—`,
        description: `Controlled selection. Shape depends on mode.`
    },
    {
        name: `onSelect`,
        type: `(value) => void`,
        default: `—`,
        description: `Fires when the user picks a date.`
    },
    {
        name: `month`,
        type: `Date`,
        default: `—`,
        description: `Controlled visible month. Pair with onMonthChange.`
    },
    {
        name: `onMonthChange`,
        type: `(month: Date) => void`,
        default: `—`,
        description: `Fires when the user navigates between months.`
    },
    {
        name: `disabled`,
        type: `Matcher | Matcher[]`,
        default: `—`,
        description: `react-day-picker Matcher — disable specific days or ranges.`
    },
    {
        name: `disableFuture`,
        type: `boolean`,
        default: `false`,
        description: `Convenience: disable every day after today.`
    },
    {
        name: `showOutsideDays`,
        type: `boolean`,
        default: `false`,
        description: `Show days from the surrounding months as faded cells.`
    },
    {
        name: `captionLayout`,
        type: `"label" | "dropdown" | "dropdown-months" | "dropdown-years"`,
        default: `"label"`,
        description: `Caption display mode. "dropdown" gives clickable month + year selectors.`
    },
    {
        name: `buttonVariant`,
        type: `"default" | "outline" | "ghost" | …`,
        default: `"ghost"`,
        description: `Visual treatment for the day buttons.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<CalendarDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.calendar;
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
                { id: ANCHOR.disableFuture, label: doc.examples.disableFuture.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/calendar.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersGrid,
        testFile: TEST_FILE,
        testName: `renders a grid of day cells for the visible month`,
        testLine: 11
    },
    {
        statement: statements.marksSelected,
        testFile: TEST_FILE,
        testName: `marks the selected day on the cell or button via data-selected* attributes`,
        testLine: 18
    },
    {
        statement: statements.firesOnSelect,
        testFile: TEST_FILE,
        testName: `fires onSelect when the user picks a day in single mode`,
        testLine: 34
    },
    {
        statement: statements.disableFutureDisables,
        testFile: TEST_FILE,
        testName: `disableFuture disables every day after today`,
        testLine: 47
    },
    {
        statement: statements.navigatesMonths,
        testFile: TEST_FILE,
        testName: `navigates to the next month when the next-month button is clicked`,
        testLine: 64
    }
];

export const CalendarDocPage = () => {
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
                        <ExampleCard
                            example={calendarExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disableFuture}
                        title={doc.examples.disableFuture.title}
                        description={doc.examples.disableFuture.description}
                    >
                        <ExampleCard
                            example={calendarExampleById(`disableFuture`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.usage} title={doc.usage.title} description={doc.usage.body}>
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body} />

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
                <PropTable heading={`<Calendar>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CalendarDocPage;
