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
import { schedulerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    selection: `examples-selection`,
    agendaOnly: `examples-agenda-only`,
    localized: `examples-localized`,
    businessHours: `examples-business-hours`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    Scheduler,
    type ScheduleItem
} from "@my-own-web-services/react-components";

const events: ScheduleItem[] = [
    { id: "1", title: "Standup", start: new Date(2026, 5, 16, 9), end: new Date(2026, 5, 16, 9, 30) }
];

<div className="h-[40rem]">
    <Scheduler
        events={events}
        onSelectItem={(e) => openDetails(e)}
        onSelectSlot={(slot) => openCreateForm(slot)}
    />
</div>`;

const COMPOSITION_SNIPPET = `// Drive view + date externally for a fully controlled calendar.
const [view, setView] = useState<SchedulerView>("week");
const [date, setDate] = useState(new Date());

<Scheduler
    events={events}
    view={view}
    onViewChange={setView}
    date={date}
    onNavigate={(next) => setDate(next)}
/>`;

const PROPS: PropRow[] = [
    { name: `events`, type: `ScheduleItem[]`, default: `[]`, description: `Already-expanded occurrences (you expand recurrences). Each has id, title, start, end, and optional allDay, color, location, editable.` },
    { name: `view / defaultView`, type: `"month" | "week" | "day" | "agenda"`, default: `first of views`, description: `Controlled / initial view. Pair view with onViewChange for control.` },
    { name: `onViewChange`, type: `(view) => void`, default: `—`, description: `Fires when the view changes.` },
    { name: `views`, type: `SchedulerView[]`, default: `all four`, description: `Which views are offered, in order. A single entry hides the switcher.` },
    { name: `date / defaultDate`, type: `Date`, default: `today`, description: `Controlled / initial focused date. Pair date with onNavigate for control.` },
    { name: `onNavigate`, type: `(date, view) => void`, default: `—`, description: `Fires on today / prev / next / drill-in.` },
    { name: `onSelectItem`, type: `(event) => void`, default: `—`, description: `An event was clicked.` },
    { name: `onSelectSlot`, type: `(slot: SlotInfo) => void`, default: `—`, description: `Empty space was clicked — the "add an event here" hook.` },
    { name: `onItemMove`, type: `(item, change: MoveChange) => void`, default: `—`, description: `An editable item was dragged to a new time/day (week/day view). Apply the change to your state. Without it nothing is draggable.` },
    { name: `onCreate`, type: `() => void`, default: `—`, description: `When set, shows an "Add event" button in the toolbar.` },
    { name: `weekStartsOn`, type: `0 … 6`, default: `locale`, description: `First day of the week (0 = Sunday). Defaults to the locale's.` },
    { name: `locale`, type: `string`, default: `provider language`, description: `BCP-47 override for every display string + the default week start.` },
    { name: `minHour / maxHour`, type: `number`, default: `0 / 24`, description: `First / last hour shown in the time grid.` },
    { name: `slotMinutes`, type: `number`, default: `30`, description: `Click-to-add snap granularity (minutes).` },
    { name: `nowIndicator`, type: `boolean`, default: `true`, description: `Show the live "now" line in week / day.` },
    { name: `className / ariaLabel`, type: `string`, default: `—`, description: `Root class and accessible group label.` }
];

const TEST_FILE = `lib/components/dateTime/scheduler/Scheduler.test.tsx`;

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<SchedulerDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.scheduler;
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
                { id: ANCHOR.selection, label: doc.examples.selection.title },
                { id: ANCHOR.agendaOnly, label: doc.examples.agendaOnly.title },
                { id: ANCHOR.localized, label: doc.examples.localized.title },
                { id: ANCHOR.businessHours, label: doc.examples.businessHours.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersViews, testFile: TEST_FILE, testName: `renders the month view: toolbar, group label, and an event chip`, testLine: 26 },
    { statement: statements.agendaLists, testFile: TEST_FILE, testName: `lists events grouped by day in agenda view`, testLine: 33 },
    { statement: statements.agendaEmpty, testFile: TEST_FILE, testName: `shows the agenda empty state when there are no events`, testLine: 40 },
    { statement: statements.selectEvent, testFile: TEST_FILE, testName: `fires onSelectItem when an event is clicked`, testLine: 56 },
    { statement: statements.selectSlot, testFile: TEST_FILE, testName: `fires onSelectSlot with an all-day slot when an empty month cell is clicked`, testLine: 70 },
    { statement: statements.switchView, testFile: TEST_FILE, testName: `switches the view via the toolbar and reports it (uncontrolled)`, testLine: 87 },
    { statement: statements.navigate, testFile: TEST_FILE, testName: `navigates to the next month when the next button is pressed`, testLine: 103 }
];

export const SchedulerDocPage = () => {
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
                        <ExampleCard example={schedulerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.selection}
                        title={doc.examples.selection.title}
                        description={doc.examples.selection.description}
                    >
                        <ExampleCard example={schedulerExampleById(`selection`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.agendaOnly}
                        title={doc.examples.agendaOnly.title}
                        description={doc.examples.agendaOnly.description}
                    >
                        <ExampleCard example={schedulerExampleById(`agendaOnly`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.localized}
                        title={doc.examples.localized.title}
                        description={doc.examples.localized.description}
                    >
                        <ExampleCard example={schedulerExampleById(`localized`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.businessHours}
                        title={doc.examples.businessHours.title}
                        description={doc.examples.businessHours.description}
                    >
                        <ExampleCard example={schedulerExampleById(`businessHours`)} hideHeader />
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <div dir={`rtl`}>
                    <ExampleCard example={schedulerExampleById(`default`)} hideHeader />
                </div>
            </DocSection>

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
                <PropTable heading={`<Scheduler>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SchedulerDocPage;
