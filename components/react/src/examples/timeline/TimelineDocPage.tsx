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
import { timelineExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    videoScrubbing: `examples-video-scrubbing`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Timeline } from "@my-own-web-services/react-components";

const events = [
    { id: "build", timestamp: Date.UTC(2026, 0, 1, 9), title: "Build" },
    { id: "deploy", timestamp: Date.UTC(2026, 0, 1, 10), title: "Deploy", status: "success" }
];

<Timeline
    from={Date.UTC(2026, 0, 1, 8)}
    to={Date.UTC(2026, 0, 1, 12)}
    events={events}
/>`;

const COMPOSITION_SNIPPET = `// The bottom scrubber always controls the visible range. When you also
// wire a playhead via \`currentTime\` + \`onCurrentTimeChange\`, the main
// track switches from a passive view to an interactive scrubber — click
// or drag anywhere on it to seek, or grab the playhead handle directly.

const [time, setTime] = React.useState(start);
const [view, setView] = React.useState({ from: start, to: end });

<Timeline
    from={start}
    to={end}
    events={chapters}
    currentTime={time}
    onCurrentTimeChange={setTime}
    viewRange={view}
    onViewRangeChange={setView}
    minViewRangeMs={500}
    formatTickLabel={(d) => formatClock(d)}
/>`;

const TIMELINE_PROPS: PropRow[] = [
    {
        name: `from`,
        type: `number | Date | string`,
        default: `(required)`,
        description: `Earliest possible time. The scrubber spans [from, to].`
    },
    {
        name: `to`,
        type: `number | Date | string`,
        default: `(required)`,
        description: `Latest possible time. Must be strictly after from.`
    },
    {
        name: `events`,
        type: `TimelineEvent[]`,
        default: `[]`,
        description: `Events plotted on the track. Each event has a timestamp; supply endTimestamp to render it as a span bar.`
    },
    {
        name: `viewRange`,
        type: `{ from: number; to: number }`,
        default: `(uncontrolled)`,
        description: `Controlled visible window. When provided, pair with onViewRangeChange.`
    },
    {
        name: `defaultViewRange`,
        type: `{ from: number; to: number }`,
        default: `[from, to]`,
        description: `Initial visible window in uncontrolled mode.`
    },
    {
        name: `onViewRangeChange`,
        type: `(range) => void`,
        default: `—`,
        description: `Fires when the user pans or zooms.`
    },
    {
        name: `minViewRangeMs`,
        type: `number`,
        default: `1000`,
        description: `Smallest allowable view window. Caps how far a user can zoom in. Lower it for frame-level scrubbing.`
    },
    {
        name: `currentTime`,
        type: `number | Date | string`,
        default: `—`,
        description: `Playhead timestamp. Renders a vertical line on the track and a tick on the scrubber.`
    },
    {
        name: `defaultCurrentTime`,
        type: `number | Date | string`,
        default: `—`,
        description: `Uncontrolled seed for the playhead.`
    },
    {
        name: `onCurrentTimeChange`,
        type: `(timestamp) => void`,
        default: `—`,
        description: `Providing this enables interactive scrubbing: clicking or dragging the track (or the playhead grip) moves the playhead.`
    },
    {
        name: `onEventClick`,
        type: `(event) => void`,
        default: `—`,
        description: `Fires when an event marker is clicked.`
    },
    {
        name: `formatTickLabel`,
        type: `(date, range) => string`,
        default: `(locale-aware)`,
        description: `Override the tick label format. Defaults to an Intl.DateTimeFormat that adapts to the visible range.`
    },
    {
        name: `title`,
        type: `ReactNode`,
        default: `—`,
        description: `Optional heading rendered above the track. Pair with the reset-zoom button on the right.`
    },
    {
        name: `labels`,
        type: `Partial<TimelineLabels>`,
        default: `(English defaults)`,
        description: `Override the accessible labels for the scrubber, resize handles, and reset-zoom button.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<TimelineDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.timeline;
};

type TimelineStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: TimelineStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                {
                    id: ANCHOR.videoScrubbing,
                    label: doc.examples.videoScrubbing.title
                }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/input/timeline/Timeline.test.tsx`;

const buildBehaviourEntries = (
    statements: TimelineStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.plotsPoints,
        testFile: TEST_FILE,
        testName: `plots a point event at the correct x position`,
        testLine: 118
    },
    {
        statement: statements.plotsRanges,
        testFile: TEST_FILE,
        testName: `plots a range event with the correct width`,
        testLine: 128
    },
    {
        statement: statements.hidesOutsideView,
        testFile: TEST_FILE,
        testName: `hides events outside the current view range`,
        testLine: 178
    },
    {
        statement: statements.rendersPlayhead,
        testFile: TEST_FILE,
        testName: `renders the playhead at the currentTime position`,
        testLine: 194
    },
    {
        statement: statements.scrubsOnClick,
        testFile: TEST_FILE,
        testName: `scrubs the playhead when the track is clicked (interactive)`,
        testLine: 213
    },
    {
        statement: statements.scrubsOnDrag,
        testFile: TEST_FILE,
        testName: `scrubs the playhead on track drag and updates as it moves`,
        testLine: 247
    },
    {
        statement: statements.readOnlyWhenNoHandler,
        testFile: TEST_FILE,
        testName: `does NOT scrub when no onCurrentTimeChange handler is provided`,
        testLine: 264
    },
    {
        statement: statements.pansOnThumb,
        testFile: TEST_FILE,
        testName: `pans the view range when the scrubber thumb is dragged`,
        testLine: 327
    },
    {
        statement: statements.zoomsOnHandle,
        testFile: TEST_FILE,
        testName: `zooms when the left scrubber handle is dragged inward`,
        testLine: 349
    },
    {
        statement: statements.clampsZoom,
        testFile: TEST_FILE,
        testName: `clamps zoom to minViewRangeMs`,
        testLine: 397
    },
    {
        statement: statements.controlled,
        testFile: TEST_FILE,
        testName: `is fully controllable — does not mutate internal state in controlled mode`,
        testLine: 461
    },
    {
        statement: statements.resetZoom,
        testFile: TEST_FILE,
        testName: `reset-zoom button appears only when zoomed in and restores the full view`,
        testLine: 422
    }
];

export const TimelineDocPage = () => {
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
                        <ExampleCard example={timelineExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.videoScrubbing}
                        title={doc.examples.videoScrubbing.title}
                        description={doc.examples.videoScrubbing.description}
                    >
                        <ExampleCard
                            example={timelineExampleById(`videoScrubbing`)}
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard example={timelineExampleById(`rtl`)} hideHeader />
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
                <PropTable heading={`<Timeline>`} rows={TIMELINE_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default TimelineDocPage;
