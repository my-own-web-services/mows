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
import { weatherExpandableExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    collapsed: `examples-collapsed`,
    headerOnly: `examples-header-only`,
    localised: `examples-localised`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    WeatherExpandable,
    type WeatherExpandableForecastDay
} from "@my-own-web-services/react-components";

const forecast: WeatherExpandableForecastDay[] = [
    { date: "2026-04-10", temp_min: 10, temp_max: 22, icon: "clear-day" },
    { date: "2026-04-11", temp_min: 8,  temp_max: 19, icon: "partly-cloudy-day",
      precipitation_probability: 30 }
];

<WeatherExpandable
    data={{
        temperature: 16.4,
        condition: "dry",
        icon: "clear-day",
        precipitation_60: 0,
        wind_speed_60: 12,
        cloud_cover: 30,
        relative_humidity: 60,
        visibility: 25000,
        pressure_msl: 1013
    }}
    forecast={forecast}
    attribution="Demo data"
    defaultOpen
/>`;

const COMPOSITION_SNIPPET = `// Controlled disclosure:
const [open, setOpen] = useState(false);
<WeatherExpandable
    data={data}
    forecast={forecast}
    open={open}
    onOpenChange={setOpen}
/>

// Header-chip aggregation rules (mirrors the omniviv reference):
//   precipitation:  precipitation_60 ?? precipitation, hidden when == 0
//   windSpeed:      wind_speed_60   ?? wind_speed

// All translatable strings override the German defaults.
<WeatherExpandable
    strings={{
        title: "Weather",
        conditionDry: "Dry",
        conditionRain: "Rain",
        cloudCoverLabel: "Cloud cover",
        expandLabel: "Show forecast",
        collapseLabel: "Hide forecast"
    }}
/>`;

const PROPS: PropRow[] = [
    { name: `data`, type: `WeatherExpandableData | null`, default: `—`, description: `Current-conditions sample. Null / omit renders the silhouette placeholder.` },
    { name: `forecast`, type: `readonly WeatherExpandableForecastDay[]`, default: `—`, description: `Daily forecast strip shown in the expanded body.` },
    { name: `attribution`, type: `ReactNode`, default: `—`, description: `Attribution line at the bottom of the body. Consumer-defined string — the library does not imply any specific source.` },
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state. Pair with onOpenChange.` },
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Initial open state when uncontrolled.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the disclosure toggles.` },
    { name: `strings`, type: `Partial<WeatherExpandableStrings>`, default: `DEFAULT_WEATHER_EXPANDABLE_STRINGS`, description: `Per-key override on top of the German defaults (which mirror the omniviv reference).` },
    { name: `locale`, type: `string`, default: `"de-DE"`, description: `BCP-47 locale used to format the forecast weekday labels.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra class names on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const DATA_PROPS: PropRow[] = [
    { name: `temperature`, type: `number | null`, default: `—`, description: `Air temperature in degrees Celsius.` },
    { name: `condition`, type: `WeatherConditionKey | string | null`, default: `—`, description: `Condition key (dry / fog / rain / sleet / snow / hail / thunderstorm). Unknown values render verbatim.` },
    { name: `icon`, type: `WeatherIconName | string | null`, default: `—`, description: `Icon key drawn from the Bright Sky / WMO vocabulary. Unknown values fall back to 🌡️.` },
    { name: `precipitation_60`, type: `number | null`, default: `—`, description: `Precipitation over the last 60 minutes (mm). Preferred over precipitation for the header chip.` },
    { name: `precipitation_10`, type: `number | null`, default: `—`, description: `Precipitation over the last 10 minutes (mm).` },
    { name: `precipitation`, type: `number | null`, default: `—`, description: `Precipitation, generic / fallback (mm). Used when precipitation_60 is missing.` },
    { name: `wind_speed_60`, type: `number | null`, default: `—`, description: `Wind speed over the last 60 minutes (km/h). Preferred over wind_speed for the header chip.` },
    { name: `wind_speed_10`, type: `number | null`, default: `—`, description: `Wind speed over the last 10 minutes (km/h).` },
    { name: `wind_speed`, type: `number | null`, default: `—`, description: `Wind speed, generic / fallback (km/h).` },
    { name: `cloud_cover`, type: `number | null`, default: `—`, description: `Cloud cover (0-100). Shown in the body extras row.` },
    { name: `relative_humidity`, type: `number | null`, default: `—`, description: `Relative humidity (0-100). Shown in the body extras row.` },
    { name: `visibility`, type: `number | null`, default: `—`, description: `Visibility in metres. Rendered as kilometres in the body extras row.` },
    { name: `pressure_msl`, type: `number | null`, default: `—`, description: `Mean-sea-level pressure (hPa). Shown in the body extras row.` }
];

const FORECAST_PROPS: PropRow[] = [
    { name: `date`, type: `string`, default: `—`, description: `ISO date yyyy-mm-dd. Formatted via the locale prop to a weekday label.` },
    { name: `temp_min`, type: `number | null`, default: `—`, description: `Daily low (°C).` },
    { name: `temp_max`, type: `number | null`, default: `—`, description: `Daily high (°C).` },
    { name: `condition`, type: `WeatherConditionKey | string | null`, default: `—`, description: `Condition key for the day.` },
    { name: `icon`, type: `WeatherIconName | string | null`, default: `—`, description: `Icon key for the day.` },
    { name: `precipitation_probability`, type: `number | null`, default: `—`, description: `Probability of precipitation (0-100). The chip renders only when > 0.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<WeatherExpandableDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.weatherExpandable;
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
                { id: ANCHOR.collapsed, label: doc.examples.collapsed.title },
                { id: ANCHOR.headerOnly, label: doc.examples.headerOnly.title },
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

const TEST_FILE = `lib/components/map/weatherExpandable/WeatherExpandable.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.placeholderNoData, testFile: TEST_FILE, testName: `renders the header with placeholder when no data is provided`, testLine: 40 },
    { statement: statements.temperatureRounded, testFile: TEST_FILE, testName: `renders the temperature rounded to an integer with the °C unit`, testLine: 51 },
    { statement: statements.emojiForIcon, testFile: TEST_FILE, testName: `renders the matching emoji for the icon key`, testLine: 58 },
    { statement: statements.emojiFallback, testFile: TEST_FILE, testName: `falls back to the thermometer emoji for unknown icon keys`, testLine: 63 },
    { statement: statements.conditionGerman, testFile: TEST_FILE, testName: `translates the condition key into German by default`, testLine: 68 },
    { statement: statements.conditionOverride, testFile: TEST_FILE, testName: `overrides condition labels via the strings prop`, testLine: 73 },
    { statement: statements.precip60Preferred, testFile: TEST_FILE, testName: `prefers precipitation_60 over precipitation for the header chip`, testLine: 83 },
    { statement: statements.precipFallback, testFile: TEST_FILE, testName: `falls back to precipitation when precipitation_60 is missing`, testLine: 94 },
    { statement: statements.precipOmittedWhenZero, testFile: TEST_FILE, testName: `omits the precipitation chip when value is zero (header is for "now it's raining")`, testLine: 103 },
    { statement: statements.wind60Preferred, testFile: TEST_FILE, testName: `prefers wind_speed_60 over wind_speed for the header chip`, testLine: 110 },
    { statement: statements.collapsedByDefault, testFile: TEST_FILE, testName: `is collapsed by default (extras + forecast are not in the DOM)`, testLine: 121 },
    { statement: statements.extrasOnExpand, testFile: TEST_FILE, testName: `expands on click and renders the extras row when extras are set`, testLine: 133 },
    { statement: statements.noExtrasRow, testFile: TEST_FILE, testName: `omits the extras row when no extras are set`, testLine: 164 },
    { statement: statements.forecastColumns, testFile: TEST_FILE, testName: `renders one forecast column per day with weekday + emoji + min/max`, testLine: 178 },
    { statement: statements.rainChipPositive, testFile: TEST_FILE, testName: `renders the rain-probability chip only when probability is positive`, testLine: 200 },
    { statement: statements.attributionWithForecast, testFile: TEST_FILE, testName: `renders the attribution inside the forecast section when both are present`, testLine: 218 },
    { statement: statements.attributionWithoutForecast, testFile: TEST_FILE, testName: `still renders the attribution when no forecast is provided (extras row only)`, testLine: 232 },
    { statement: statements.firesOnOpenChange, testFile: TEST_FILE, testName: `fires onOpenChange when the disclosure toggles`, testLine: 246 },
    { statement: statements.controllableOpen, testFile: TEST_FILE, testName: `is fully controllable via open + onOpenChange`, testLine: 262 },
    { statement: statements.defaultOpen, testFile: TEST_FILE, testName: `defaultOpen renders the body on first paint`, testLine: 284 },
    { statement: statements.disclosureAriaLabel, testFile: TEST_FILE, testName: `disclosure button advertises the right aria-label per state`, testLine: 296 },
    { statement: statements.disabledWhenEmpty, testFile: TEST_FILE, testName: `disables the disclosure when there is no body content (no extras / no forecast / no attribution)`, testLine: 314 },
    { statement: statements.chevronHiddenWhenDisabled, testFile: TEST_FILE, testName: `hides the chevron when the disclosure is disabled (header-only mode)`, testLine: 329 },
    { statement: statements.enabledWithAttributionOnly, testFile: TEST_FILE, testName: `enables the disclosure when only attribution is set (still something to reveal)`, testLine: 338 },
    { statement: statements.extrasTooltipsTranslated, testFile: TEST_FILE, testName: `extras chips carry the translated tooltip labels`, testLine: 354 },
    { statement: statements.regionAriaLabel, testFile: TEST_FILE, testName: `region carries the translated aria-label`, testLine: 376 },
    { statement: statements.emojiVocabulary, testFile: TEST_FILE, testName: `resolveWeatherEmoji exposes the full vocabulary mapping (port parity)`, testLine: 386 }
];

export const WeatherExpandableDocPage = () => {
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
                            example={weatherExpandableExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.collapsed}
                        title={doc.examples.collapsed.title}
                        description={doc.examples.collapsed.description}
                    >
                        <ExampleCard
                            example={weatherExpandableExampleById(`collapsed`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.headerOnly}
                        title={doc.examples.headerOnly.title}
                        description={doc.examples.headerOnly.description}
                    >
                        <ExampleCard
                            example={weatherExpandableExampleById(`headerOnly`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.localised}
                        title={doc.examples.localised.title}
                        description={doc.examples.localised.description}
                    >
                        <ExampleCard
                            example={weatherExpandableExampleById(`localised`)}
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
                <div className={`flex flex-col gap-6`}>
                    <PropTable heading={`<WeatherExpandable>`} rows={PROPS} />
                    <PropTable heading={`WeatherExpandableData`} rows={DATA_PROPS} />
                    <PropTable heading={`WeatherExpandableForecastDay`} rows={FORECAST_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default WeatherExpandableDocPage;
