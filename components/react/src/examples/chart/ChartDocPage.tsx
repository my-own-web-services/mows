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
import { chartExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    bar: `examples-bar`,
    line: `examples-line`,
    area: `examples-area`,
    pie: `examples-pie`,
    radar: `examples-radar`,
    radial: `examples-radial`,
    themed: `examples-themed`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "@mows/react-components";

const config = {
    desktop: { label: "Desktop", color: "var(--chart-1)" },
    mobile:  { label: "Mobile",  color: "var(--chart-2)" }
} satisfies ChartConfig;

<ChartContainer config={config} className="min-h-[260px] w-full">
    <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
        <Bar dataKey="mobile"  fill="var(--color-mobile)"  radius={4} />
    </BarChart>
</ChartContainer>`;

const COMPOSITION_SNIPPET = `// <ChartContainer> owns:
//   - a <ResponsiveContainer> that fills its parent box
//   - a generated [data-chart="chart-…"] id used to scope CSS vars
//   - a <ChartStyle> block that maps each config entry to
//     "--color-<key>: <colour>" (one rule for light, one for ".dark")
//
// Series consume those vars as fill / stroke values — flip themes
// and the chart re-paints with no JS work.
//
// <ChartTooltipContent> reads the same config to resolve the
// human-readable label for each series ("desktop" → "Desktop")
// and the colour swatch beside each value.

const config = {
    revenue: { label: "Revenue", theme: { light: "#0f172a", dark: "#f8fafc" } }
} satisfies ChartConfig;

<ChartContainer config={config}>
    <BarChart data={data}>
        <Bar dataKey="revenue" fill="var(--color-revenue)" />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
    </BarChart>
</ChartContainer>`;

const CONTAINER_PROPS: PropRow[] = [
    {
        name: `config`,
        type: `ChartConfig`,
        default: `—`,
        description: `Map of series keys to { label, color | theme, icon }. Each entry becomes a "--color-<key>" CSS variable on the chart's scope.`
    },
    {
        name: `id`,
        type: `string`,
        default: `auto`,
        description: `Stable id used in the generated "data-chart" attribute. Useful when you need to target the chart from external CSS.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged onto the chart wrapper. Use to set min-height / aspect-ratio because the inner ResponsiveContainer fills 100% of the wrapper.`
    },
    {
        name: `children`,
        type: `ReactNode`,
        default: `—`,
        description: `The single recharts chart element (BarChart, LineChart, PieChart, …) rendered inside the ResponsiveContainer.`
    }
];

const TOOLTIP_PROPS: PropRow[] = [
    {
        name: `active`,
        type: `boolean`,
        default: `—`,
        description: `Passed by recharts — when false the content returns null.`
    },
    {
        name: `payload`,
        type: `Payload[]`,
        default: `—`,
        description: `Passed by recharts — array of points hovered at the current x value.`
    },
    {
        name: `indicator`,
        type: `"dot" | "line" | "dashed"`,
        default: `"dot"`,
        description: `Shape of the colour swatch shown next to each series row.`
    },
    {
        name: `hideLabel`,
        type: `boolean`,
        default: `false`,
        description: `Hide the header row that shows the x-axis label.`
    },
    {
        name: `hideIndicator`,
        type: `boolean`,
        default: `false`,
        description: `Hide the colour swatch column entirely.`
    },
    {
        name: `nameKey`,
        type: `string`,
        default: `—`,
        description: `Override which payload field is used as the lookup into config (defaults to "name" or "dataKey").`
    },
    {
        name: `labelKey`,
        type: `string`,
        default: `—`,
        description: `Override which payload field provides the header label.`
    },
    {
        name: `formatter`,
        type: `(value, name, item, index, payload) => ReactNode`,
        default: `—`,
        description: `Replace the default row rendering with custom JSX per data point.`
    },
    {
        name: `labelFormatter`,
        type: `(value, payload) => ReactNode`,
        default: `—`,
        description: `Replace the header label rendering.`
    }
];

const LEGEND_PROPS: PropRow[] = [
    {
        name: `payload`,
        type: `LegendPayload[]`,
        default: `—`,
        description: `Passed by recharts — array of series shown in the legend.`
    },
    {
        name: `verticalAlign`,
        type: `"top" | "bottom"`,
        default: `"bottom"`,
        description: `Pad above vs. below the row. Pass the same value you give to <Legend>.`
    },
    {
        name: `hideIcon`,
        type: `boolean`,
        default: `false`,
        description: `Suppress the per-series icon (falls back to a coloured square).`
    },
    {
        name: `nameKey`,
        type: `string`,
        default: `—`,
        description: `Override which payload field is used as the lookup into config.`
    }
];

const CONFIG_PROPS: PropRow[] = [
    {
        name: `label`,
        type: `ReactNode`,
        default: `—`,
        description: `Display name used by ChartTooltipContent and ChartLegendContent.`
    },
    {
        name: `color`,
        type: `string`,
        default: `—`,
        description: `Single colour value (any valid CSS colour). Becomes the value of "--color-<key>" in both themes.`
    },
    {
        name: `theme`,
        type: `{ light: string; dark: string }`,
        default: `—`,
        description: `Per-theme colour values. The container emits one rule per theme. Mutually exclusive with "color".`
    },
    {
        name: `icon`,
        type: `ComponentType`,
        default: `—`,
        description: `Optional icon component rendered in tooltip / legend rows.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ChartDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.chart;
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
                { id: ANCHOR.bar, label: doc.examples.bar.title },
                { id: ANCHOR.line, label: doc.examples.line.title },
                { id: ANCHOR.area, label: doc.examples.area.title },
                { id: ANCHOR.pie, label: doc.examples.pie.title },
                { id: ANCHOR.radar, label: doc.examples.radar.title },
                { id: ANCHOR.radial, label: doc.examples.radial.title },
                { id: ANCHOR.themed, label: doc.examples.themed.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/ui/chart.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersWrapper,
        testFile: TEST_FILE,
        testName: `renders a data-slot="chart" wrapper`,
        testLine: 40
    },
    {
        statement: statements.stableDataChartId,
        testFile: TEST_FILE,
        testName: `tags the wrapper with a stable data-chart id`,
        testLine: 52
    },
    {
        statement: statements.forwardsClassName,
        testFile: TEST_FILE,
        testName: `forwards an extra className`,
        testLine: 64
    },
    {
        statement: statements.emitsStyleVars,
        testFile: TEST_FILE,
        testName: `emits a <ChartStyle> block with CSS vars from the config`,
        testLine: 76
    },
    {
        statement: statements.mountsRecharts,
        testFile: TEST_FILE,
        testName: `mounts a recharts Tooltip child when one is configured`,
        testLine: 91
    },
    {
        statement: statements.styleNothingWithoutColor,
        testFile: TEST_FILE,
        testName: `renders nothing when no config entry has a color or theme`,
        testLine: 107
    },
    {
        statement: statements.styleThemeScopes,
        testFile: TEST_FILE,
        testName: `renders a style block with both light and dark theme selectors`,
        testLine: 114
    },
    {
        statement: statements.tooltipInactive,
        testFile: TEST_FILE,
        testName: `renders nothing when not active`,
        testLine: 135
    },
    {
        statement: statements.tooltipRendersLabel,
        testFile: TEST_FILE,
        testName: `renders the configured label and formatted value for a payload entry`,
        testLine: 147
    },
    {
        statement: statements.legendEmptyPayload,
        testFile: TEST_FILE,
        testName: `renders nothing when payload is empty`,
        testLine: 176
    },
    {
        statement: statements.legendRendersRows,
        testFile: TEST_FILE,
        testName: `renders one row per payload entry with the configured label`,
        testLine: 188
    }
];

export const ChartDocPage = () => {
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
                        id={ANCHOR.bar}
                        title={doc.examples.bar.title}
                        description={doc.examples.bar.description}
                    >
                        <ExampleCard example={chartExampleById(`bar`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.line}
                        title={doc.examples.line.title}
                        description={doc.examples.line.description}
                    >
                        <ExampleCard example={chartExampleById(`line`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.area}
                        title={doc.examples.area.title}
                        description={doc.examples.area.description}
                    >
                        <ExampleCard example={chartExampleById(`area`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.pie}
                        title={doc.examples.pie.title}
                        description={doc.examples.pie.description}
                    >
                        <ExampleCard example={chartExampleById(`pie`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.radar}
                        title={doc.examples.radar.title}
                        description={doc.examples.radar.description}
                    >
                        <ExampleCard example={chartExampleById(`radar`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.radial}
                        title={doc.examples.radial.title}
                        description={doc.examples.radial.description}
                    >
                        <ExampleCard example={chartExampleById(`radial`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.themed}
                        title={doc.examples.themed.title}
                        description={doc.examples.themed.description}
                    >
                        <ExampleCard example={chartExampleById(`themed`)} hideHeader />
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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<ChartContainer>`} rows={CONTAINER_PROPS} />
                    <PropTable heading={`<ChartTooltipContent>`} rows={TOOLTIP_PROPS} />
                    <PropTable heading={`<ChartLegendContent>`} rows={LEGEND_PROPS} />
                    <PropTable heading={`ChartConfig entry`} rows={CONFIG_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default ChartDocPage;
