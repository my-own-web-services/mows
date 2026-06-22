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
import { openingHoursExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    collapsible: `examples-collapsible`,
    closingSoon: `examples-closing-soon`,
    closed: `examples-closed`,
    weekOnly: `examples-week-only`,
    usage: `usage`,
    composition: `composition`,
    osmFormat: `osm-format`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { OpeningHours } from "@my-own-web-services/react-components";

<OpeningHours rules="Mo-Fr 09:00-18:00; Sa 10:00-14:00" />`;

const COMPOSITION_SNIPPET = `// Pass a raw OSM opening_hours string. Pin \`now\` for tests / SSR,
// override the locale to align with your language picker, or pre-parse
// to keep the work off the render path.

import {
    OpeningHours,
    parseOsmOpeningHoursSchedule
} from "@my-own-web-services/react-components";

const RULE = "Mo-Fr 09:00-18:00; Sa 10:00-14:00";

// (1) Default — status pill as trigger, week table behind a disclosure.
<OpeningHours rules={RULE} />

// (2) Same shape but open on first render.
<OpeningHours rules={RULE} defaultOpen />

// (3) Disable the disclosure entirely — status + table inline.
<OpeningHours rules={RULE} collapsible={false} />

// (4) Status pill only (no table to disclose, \`collapsible\` is a no-op).
<OpeningHours rules={RULE} variant="status" />

// (5) Week table only.
<OpeningHours rules={RULE} variant="week" />

// (6) Pre-parsed via the helper — parsing happens once at fetch time,
// then the component is purely presentational.
const schedule = parseOsmOpeningHoursSchedule(RULE, new Date(), {
    locale: "de-DE"
});
<OpeningHours schedule={schedule} />`;

const PROPS: PropRow[] = [
    {
        name: `rules`,
        type: `string | null`,
        default: `—`,
        description: `Raw OSM \`opening_hours\` value. Mutually exclusive with \`schedule\`. Empty / unparsable values render nothing.`
    },
    {
        name: `schedule`,
        type: `OpeningHoursSchedule`,
        default: `—`,
        description: `Pre-parsed status + week. Pass when you want to keep parsing out of the render path. Wins over \`rules\` when both are supplied.`
    },
    {
        name: `now`,
        type: `Date`,
        default: `live (ticks once / minute)`,
        description: `Reference moment for the status. Pass a fixed \`Date\` for deterministic snapshots.`
    },
    {
        name: `locale`,
        type: `string`,
        default: `MowsContext.currentLanguage.code → browser default`,
        description: `BCP 47 locale for \`HH:mm\` and weekday formatting via \`Intl.DateTimeFormat\`. Also selects the bundled translation when \`strings\` is not passed (English + German shipped; other locales fall through to English).`
    },
    {
        name: `weekStart`,
        type: `"monday" | "sunday"`,
        default: `"monday"`,
        description: `Anchor day for the seven-row week.`
    },
    {
        name: `variant`,
        type: `"full" | "status" | "week" | "inline"`,
        default: `"full"`,
        description: `Visual mode. \`full\` shows both halves; \`status\` / \`week\` show one half; \`inline\` flows into prose without the clock icon.`
    },
    {
        name: `collapsible`,
        type: `boolean`,
        default: `true`,
        description: `When \`variant="full"\`, hide the week table behind a disclosure and promote the status line to the trigger. Set to \`false\` to render both halves inline. No-op for \`status\` / \`week\` / \`inline\`.`
    },
    {
        name: `defaultOpen`,
        type: `boolean`,
        default: `false`,
        description: `Initial state of the disclosure when \`collapsible\` is on. Ignored when the disclosure isn't active.`
    },
    {
        name: `strings`,
        type: `Partial<OpeningHoursStrings>`,
        default: `OPENING_HOURS_STRINGS_BY_LOCALE[locale] ?? DEFAULT_OPENING_HOURS_STRINGS`,
        description: `Translation overrides layered on top of the locale-resolved bundle. \`{time}\`, \`{weekday}\`, \`{count}\`, \`{unit}\` placeholders are substituted at render time.`
    },
    {
        name: `toneClassName`,
        type: `Record<OpeningHoursTone, string>`,
        default: `built-in emerald / amber palette`,
        description: `Override the tone → class map to align with your own design tokens.`
    },
    {
        name: `trailing`,
        type: `ReactNode`,
        default: `—`,
        description: `Slot rendered after the status line. Useful for badges / source chips.`
    },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<OpeningHoursDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.openingHours;
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
                { id: ANCHOR.collapsible, label: doc.examples.collapsible.title },
                { id: ANCHOR.closingSoon, label: doc.examples.closingSoon.title },
                { id: ANCHOR.closed, label: doc.examples.closed.title },
                { id: ANCHOR.weekOnly, label: doc.examples.weekOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.osmFormat, label: doc.osmFormat.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/dateTime/openingHours/OpeningHours.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.emptyRules, testFile: TEST_FILE, testName: `renders nothing when rules are empty`, testLine: 22 },
    { statement: statements.garbageRules, testFile: TEST_FILE, testName: `renders nothing when rules are garbage`, testLine: 27 },
    { statement: statements.openHeadline, testFile: TEST_FILE, testName: `shows the open headline and a "closes at" detail when currently open`, testLine: 34 },
    { statement: statements.closingSoonHeadline, testFile: TEST_FILE, testName: `marks the status as closingSoon when within an hour of close`, testLine: 50 },
    { statement: statements.closedHeadline, testFile: TEST_FILE, testName: `shows the closed headline and an "opens at" detail when closed`, testLine: 61 },
    { statement: statements.weekStrip, testFile: TEST_FILE, testName: `renders the seven-day strip with today highlighted`, testLine: 77 },
    { statement: statements.statusVariant, testFile: TEST_FILE, testName: `omits the table when variant="status"`, testLine: 98 },
    { statement: statements.weekVariant, testFile: TEST_FILE, testName: `omits the status when variant="week"`, testLine: 106 },
    { statement: statements.alwaysOpen, testFile: TEST_FILE, testName: `uses the alwaysOpen headline for 24/7 rules`, testLine: 115 },
    { statement: statements.preParsedSchedule, testFile: TEST_FILE, testName: `accepts a pre-parsed schedule and skips internal parsing`, testLine: 129 },
    { statement: statements.crossMidnight, testFile: TEST_FILE, testName: `clamps cross-midnight intervals at the day boundary as 24:00`, testLine: 152 },
    { statement: statements.stringsOverride, testFile: TEST_FILE, testName: `renders translation overrides for headline + detail`, testLine: 164 },
    { statement: statements.collapsibleDefault, testFile: TEST_FILE, testName: `hides the week table behind a disclosure by default and reveals it on toggle`, testLine: 180 },
    { statement: statements.defaultOpen, testFile: TEST_FILE, testName: `starts open when defaultOpen is true`, testLine: 203 },
    { statement: statements.localeFallback, testFile: TEST_FILE, testName: `picks bundled German strings when locale="de" without explicit strings prop`, testLine: 220 }
];

export const OpeningHoursDocPage = () => {
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
                        <ExampleCard example={openingHoursExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.collapsible}
                        title={doc.examples.collapsible.title}
                        description={doc.examples.collapsible.description}
                    >
                        <ExampleCard example={openingHoursExampleById(`collapsible`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.closingSoon}
                        title={doc.examples.closingSoon.title}
                        description={doc.examples.closingSoon.description}
                    >
                        <ExampleCard example={openingHoursExampleById(`closingSoon`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.closed}
                        title={doc.examples.closed.title}
                        description={doc.examples.closed.description}
                    >
                        <ExampleCard example={openingHoursExampleById(`closed`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.weekOnly}
                        title={doc.examples.weekOnly.title}
                        description={doc.examples.weekOnly.description}
                    >
                        <ExampleCard example={openingHoursExampleById(`weekOnly`)} hideHeader />
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

            <DocSection id={ANCHOR.osmFormat} title={doc.osmFormat.title} description={doc.osmFormat.body}>
                <p className={`text-sm`}>
                    <a
                        href={`https://wiki.openstreetmap.org/wiki/Key:opening_hours`}
                        target={`_blank`}
                        rel={`noopener noreferrer`}
                        className={`text-primary underline-offset-2 hover:underline`}
                    >
                        {doc.osmFormat.wikiLinkLabel}
                    </a>
                </p>
                <div className={`flex flex-col gap-2`}>
                    <h4 className={`text-base font-semibold`}>{doc.osmFormat.examplesHeading}</h4>
                    <p className={`text-sm text-muted-foreground`}>{doc.osmFormat.examplesIntro}</p>
                    <table className={`w-full text-sm tabular-nums border-collapse`}>
                        <tbody>
                            {doc.osmFormat.samples.map((sample) => (
                                <tr
                                    key={sample.rule}
                                    className={`border-b border-border/50 last:border-b-0`}
                                >
                                    <th
                                        scope={`row`}
                                        className={`align-top px-3 py-1.5 text-left font-mono text-xs`}
                                    >
                                        {sample.rule}
                                    </th>
                                    <td className={`align-top px-3 py-1.5 text-muted-foreground`}>
                                        {sample.meaning}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard example={openingHoursExampleById(`rtl`)} hideHeader />
            </DocSection>

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList entries={behaviourEntries} verifiedByLabel={doc.definedBehaviour.verifiedBy} />
            </DocSection>

            <DocSection id={ANCHOR.apiReference} title={doc.apiReference.title} description={doc.apiReference.intro}>
                <PropTable heading={`<OpeningHours>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default OpeningHoursDocPage;
