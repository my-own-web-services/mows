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
import { mapExampleById } from "./index";

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

const PACKAGE_INSTALL = `add @my-own-web-services/react-components maplibre-gl`;

const USAGE_SNIPPET = `import { Map } from "@my-own-web-services/react-components";

<div style={{ height: 400 }}>
    <Map
        projection="globe"
        initialView={{ longitude: 10.45, latitude: 51.16, zoom: 1.5 }}
    />
</div>`;

const COMPOSITION_SNIPPET = `// Without a mapStyle prop, <Map> subscribes to currentMapStyle on
// MowsContext — picking a new style in the SettingsPanel reflows every
// mounted Map. Pass an explicit MowsMapStyle to opt out per instance.

import { Map, type MowsMapStyle } from "@my-own-web-services/react-components";

const customStyle: MowsMapStyle = {
    id: "company-dark",
    name: "Company Dark",
    url: "https://tiles.example.com/dark/style.json"
};

<Map mapStyle={customStyle} />`;

const PROPS: PropRow[] = [
    { name: `mapStyle`, type: `MowsMapStyle`, default: `currentMapStyle`, description: `Override the active style for this map. Defaults to the context's currentMapStyle so the SettingsPanel can drive every Map at once.` },
    { name: `initialView`, type: `MapView`, default: `{ longitude: 0, latitude: 0, zoom: 1 }`, description: `Initial camera position. After mount, maplibre-gl owns the view.` },
    { name: `projection`, type: `"globe" | "mercator"`, default: `"globe"`, description: `Camera projection. Globe inflates to a sphere when zoomed out; mercator pins the classic flat Web Mercator view at every zoom.` },
    { name: `interactive`, type: `boolean`, default: `true`, description: `Whether the user can pan / zoom / rotate. Set false for static previews.` },
    { name: `hash`, type: `boolean`, default: `false`, description: `Mirror map state into the URL hash.` },
    { name: `showControls`, type: `boolean`, default: `true`, description: `Render the themed zoom / compass / locate stack in the top-right and the attribution info button in the bottom-right.` },
    { name: `accessToken`, type: `string`, default: `mapStyle.accessToken`, description: `Per-request token appended to tile URLs via maplibre's transformRequest. Most tokenless styles ignore it.` },
    { name: `onLoad`, type: `(map: maplibregl.Map) => void`, default: `—`, description: `Fires once maplibre-gl emits "load" — the moment the first style finishes loading.` },
    { name: `onMoveEnd`, type: `(view: MapView) => void`, default: `—`, description: `Fires when the camera settles after a user gesture; receives the final position.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<MapDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.map;
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
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/map/Map.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.lazyLoadsMapbox, testFile: TEST_FILE, testName: `shows a loading skeleton until the lazy chunk resolves`, testLine: 215 },
    { statement: statements.usesContextStyle, testFile: TEST_FILE, testName: `instantiates a maplibre-gl Map with the context's current style by default`, testLine: 220 },
    { statement: statements.propOverridesContext, testFile: TEST_FILE, testName: `uses the explicit mapStyle prop over the context value when provided`, testLine: 227 },
    { statement: statements.appliesAccessToken, testFile: TEST_FILE, testName: `installs a transformRequest that appends the active style's accessToken`, testLine: 239 },
    { statement: statements.reactsToContextChange, testFile: TEST_FILE, testName: `calls setStyle when the context's current map style changes`, testLine: 254 },
    { statement: statements.firesOnLoad, testFile: TEST_FILE, testName: `fires onLoad once the underlying map emits "load"`, testLine: 272 },
    { statement: statements.cleansUpOnUnmount, testFile: TEST_FILE, testName: `calls map.remove() on unmount`, testLine: 294 }
];

export const MapDocPage = () => {
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
                        <ExampleCard example={mapExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<Map>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default MapDocPage;
