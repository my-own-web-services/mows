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
import { weatherChipExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    current: `examples-current`,
    forecast: `examples-forecast`,
    historical: `examples-historical`,
    loading: `examples-loading`,
    error: `examples-error`,
    empty: `examples-empty`,
    overMap: `examples-over-map`,
    localised: `examples-localised`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { WeatherChip } from "@my-own-web-services/react-components";

<WeatherChip
    data={{
        temperature: 16.4,
        condition: "dry",
        icon: "clear-day",
        windSpeed: 12,
        relativeHumidity: 42
    }}
    attribution="Demo data"
/>`;

const COMPOSITION_SNIPPET = `// WeatherChip is data-source agnostic — the library bundles no
// fetcher and implies no provider. Wire your own source however you
// like (REST, websocket, server enrichment …) and forward the record
// as data. Drive mode/at to show forecast or historical samples; pass
// loading/error to surface fetch state without re-mounting the chip.

const [data, setData] = useState<WeatherRecord | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// e.g. plug into your own data layer:
//   useEffect(() => subscribeToWeather({ lat, lon, at }, {
//     onData: setData, onError: setError, onLoading: setLoading
//   }), [lat, lon, at]);

// Position the chip yourself — drop it absolutely inside a relative
// container (e.g. on top of a <Map>), into a sidebar, or wherever
// fits your layout.
<div className="relative">
    <Map ... />
    <div className="absolute top-3 right-3 z-10">
        <WeatherChip
            data={data}
            mode={at ? "historical" : "current"}
            at={at}
            loading={loading}
            error={error}
            attribution="Demo data"
        />
    </div>
</div>`;

const PROPS: PropRow[] = [
    {
        name: `data`,
        type: `WeatherRecord | null`,
        default: `null`,
        description: `Structured weather sample. Pass null (or omit) to render the placeholder layout — useful while the first fetch is in flight.`
    },
    {
        name: `mode`,
        type: `"current" | "historical" | "forecast"`,
        default: `"current"`,
        description: `Which point in time the sample describes. Drives the footer label.`
    },
    {
        name: `at`,
        type: `Date | number | string | null`,
        default: `—`,
        description: `Timestamp the sample describes. Required for "historical" and "forecast" mode so the footer can render the formatted time. Ignored in "current" mode.`
    },
    {
        name: `loading`,
        type: `boolean`,
        default: `false`,
        description: `Show a pulsing dot next to the time label. Existing data stays visible.`
    },
    {
        name: `error`,
        type: `string | null`,
        default: `—`,
        description: `Error message rendered beneath the metrics row with role="alert" and the destructive accent.`
    },
    {
        name: `attribution`,
        type: `ReactNode`,
        default: `—`,
        description: `Attribution line shown beneath the chip. Consumer-defined string — the library does not imply any specific source.`
    },
    {
        name: `strings`,
        type: `Partial<WeatherChipStrings>`,
        default: `DEFAULT_WEATHER_CHIP_STRINGS`,
        description: `Override individual translated strings (condition labels, mode prefixes, unit suffixes).`
    },
    {
        name: `locale`,
        type: `string`,
        default: `navigator.language`,
        description: `BCP-47 tag used to format the timestamp in "historical" / "forecast" mode.`
    },
    {
        name: `formatTimeLabel`,
        type: `(args) => ReactNode`,
        default: `—`,
        description: `Replace the default <mode> · <date> footer with your own renderer.`
    },
    {
        name: `formatTemperature`,
        type: `(temp, strings) => string`,
        default: `Math.round + °C`,
        description: `Replace the default integer-rounded temperature formatter — e.g. to render Fahrenheit or add a sign.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer wrapper.`
    }
];

const RECORD_PROPS: PropRow[] = [
    { name: `temperature`, type: `number | null`, default: `—`, description: `Air temperature in degrees Celsius.` },
    { name: `condition`, type: `WeatherConditionKey | string | null`, default: `—`, description: `Condition key (dry / fog / rain / sleet / snow / hail / thunderstorm). Unknown values render verbatim.` },
    { name: `icon`, type: `WeatherIconName | string | null`, default: `—`, description: `Icon key drawn from the canonical Bright Sky / WMO vocabulary. Unknown values fall back to the thermometer glyph.` },
    { name: `precipitation`, type: `number | null`, default: `—`, description: `Precipitation in millimetres for the sampling period.` },
    { name: `windSpeed`, type: `number | null`, default: `—`, description: `Wind speed in km/h.` },
    { name: `relativeHumidity`, type: `number | null`, default: `—`, description: `Relative humidity (0-100).` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<WeatherChipDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.weatherChip;
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
                { id: ANCHOR.current, label: doc.examples.current.title },
                { id: ANCHOR.forecast, label: doc.examples.forecast.title },
                { id: ANCHOR.historical, label: doc.examples.historical.title },
                { id: ANCHOR.loading, label: doc.examples.loading.title },
                { id: ANCHOR.error, label: doc.examples.error.title },
                { id: ANCHOR.empty, label: doc.examples.empty.title },
                { id: ANCHOR.overMap, label: doc.examples.overMap.title },
                { id: ANCHOR.localised, label: doc.examples.localised.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/map/weatherChip/WeatherChip.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.defaultPlaceholder,
        testFile: TEST_FILE,
        testName: `renders the default placeholder when no data is provided`,
        testLine: 11
    },
    {
        statement: statements.roundsTemperature,
        testFile: TEST_FILE,
        testName: `renders the temperature rounded to an integer with the °C unit`,
        testLine: 23
    },
    {
        statement: statements.translatesCondition,
        testFile: TEST_FILE,
        testName: `translates the condition key into the matching label`,
        testLine: 28
    },
    {
        statement: statements.historicalLabel,
        testFile: TEST_FILE,
        testName: `pretty-prints the timestamp in historical mode with the supplied locale`,
        testLine: 38
    },
    {
        statement: statements.forecastLabel,
        testFile: TEST_FILE,
        testName: `pretty-prints the timestamp in forecast mode with the supplied locale`,
        testLine: 51
    },
    {
        statement: statements.currentFallback,
        testFile: TEST_FILE,
        testName: `falls back to the current-mode label when no timestamp is supplied`,
        testLine: 63
    },
    {
        statement: statements.metricsOptional,
        testFile: TEST_FILE,
        testName: `renders metrics only when their values are numbers`,
        testLine: 69
    },
    {
        statement: statements.loadingIndicator,
        testFile: TEST_FILE,
        testName: `shows a loading indicator with the localised aria-label when loading={true}`,
        testLine: 83
    },
    {
        statement: statements.errorAlert,
        testFile: TEST_FILE,
        testName: `surfaces the error string with role="alert" when error is set`,
        testLine: 90
    },
    {
        statement: statements.attribution,
        testFile: TEST_FILE,
        testName: `renders the supplied attribution node beneath the chip`,
        testLine: 97
    },
    {
        statement: statements.formatTimeOverride,
        testFile: TEST_FILE,
        testName: `uses the consumer's formatTimeLabel override`,
        testLine: 102
    },
    {
        statement: statements.formatTemperatureOverride,
        testFile: TEST_FILE,
        testName: `uses the consumer's formatTemperature override`,
        testLine: 117
    },
    {
        statement: statements.timestampInputs,
        testFile: TEST_FILE,
        testName: `accepts a timestamp passed as a number (ms epoch) or string`,
        testLine: 131
    },
    {
        statement: statements.dataModeAttribute,
        testFile: TEST_FILE,
        testName: `exposes data-mode on the root for downstream styling`,
        testLine: 151
    }
];

export const WeatherChipDocPage = () => {
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
                        id={ANCHOR.current}
                        title={doc.examples.current.title}
                        description={doc.examples.current.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`current`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.forecast}
                        title={doc.examples.forecast.title}
                        description={doc.examples.forecast.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`forecast`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.historical}
                        title={doc.examples.historical.title}
                        description={doc.examples.historical.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`historical`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.loading}
                        title={doc.examples.loading.title}
                        description={doc.examples.loading.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`loading`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.error}
                        title={doc.examples.error.title}
                        description={doc.examples.error.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`error`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.empty}
                        title={doc.examples.empty.title}
                        description={doc.examples.empty.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`empty`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.overMap}
                        title={doc.examples.overMap.title}
                        description={doc.examples.overMap.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`overMap`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.localised}
                        title={doc.examples.localised.title}
                        description={doc.examples.localised.description}
                    >
                        <ExampleCard
                            example={weatherChipExampleById(`localised`)}
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard
                    example={weatherChipExampleById(`rtl`)}
                    hideHeader
                />
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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<WeatherChip>`} rows={PROPS} />
                    <PropTable heading={`WeatherRecord`} rows={RECORD_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default WeatherChipDocPage;
