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
import { coordinateLinksExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    withLabel: `examples-with-label`,
    custom: `examples-custom`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { CoordinateLinks } from "@my-own-web-services/react-components";

<CoordinateLinks latitude={48.137154} longitude={11.576124} />`;

const COMPOSITION_SNIPPET = `// Either pass built-in provider ids, or full MapProvider records
// (or a mix of both). Unknown built-in ids throw at resolve time —
// no silent empty render.

<CoordinateLinks
    latitude={48.137154}
    longitude={11.576124}
    zoom={12}
    label="Open in"
    providers={[
        "geo",
        "openstreetmap",
        "google",
        {
            id: "acme",
            label: "ACME Geo",
            buildUrl: (lat, lng) =>
                \`https://example.com/?p=\${lat.toFixed(4)},\${lng.toFixed(4)}\`
        }
    ]}
/>`;

const PROPS: PropRow[] = [
    { name: `latitude`, type: `number`, default: `—`, description: `Latitude in decimal degrees, -90 ≤ value ≤ 90.` },
    { name: `longitude`, type: `number`, default: `—`, description: `Longitude in decimal degrees, -180 ≤ value ≤ 180.` },
    { name: `zoom`, type: `number`, default: `14`, description: `Forwarded to providers that honour it (OSM, Bing, and the geo: query string).` },
    { name: `providers`, type: `Array<MapProviderId | MapProvider>`, default: `DEFAULT_PROVIDER_ORDER`, description: `Built-in ids and/or full records. Resolved order is rendered verbatim.` },
    { name: `label`, type: `string`, default: `—`, description: `Optional heading rendered above the link list.` },
    { name: `precision`, type: `number`, default: `5`, description: `Decimal places for any provider whose label derives from the coordinate (currently the geo: built-in).` },
    { name: `openInLabel`, type: `string`, default: `"Open in"`, description: `Prefix used in each link's aria-label (translated).` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<CoordinateLinksDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.coordinateLinks;
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
                { id: ANCHOR.withLabel, label: doc.examples.withLabel.title },
                { id: ANCHOR.custom, label: doc.examples.custom.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/map/coordinateLinks/CoordinateLinks.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersDefaultProviders,
        testFile: TEST_FILE,
        testName: `renders one link per default provider when no list is given`,
        testLine: 18
    },
    {
        statement: statements.geoUsesCoordinate,
        testFile: TEST_FILE,
        testName: `uses the coordinate as the link text for the geo: provider`,
        testLine: 24
    },
    {
        statement: statements.opensInNewTab,
        testFile: TEST_FILE,
        testName: `opens every link in a new tab with noopener referrer hygiene`,
        testLine: 36
    },
    {
        statement: statements.respectsCustomOrder,
        testFile: TEST_FILE,
        testName: `renders provider order from the prop verbatim`,
        testLine: 66
    },
    {
        statement: statements.acceptsCustomProvider,
        testFile: TEST_FILE,
        testName: `accepts a custom provider record alongside built-in ids`,
        testLine: 79
    },
    {
        statement: statements.validatesCoordinate,
        testFile: TEST_FILE,
        testName: `throws synchronously for an out-of-range latitude`,
        testLine: 126
    }
];

export const CoordinateLinksDocPage = () => {
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
                            example={coordinateLinksExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.withLabel}
                        title={doc.examples.withLabel.title}
                        description={doc.examples.withLabel.description}
                    >
                        <ExampleCard
                            example={coordinateLinksExampleById(`withLabel`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.custom}
                        title={doc.examples.custom.title}
                        description={doc.examples.custom.description}
                    >
                        <ExampleCard
                            example={coordinateLinksExampleById(`custom`)}
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
                <div dir={`rtl`} className={`max-w-md`}>
                    <ExampleCard example={coordinateLinksExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<CoordinateLinks>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CoordinateLinksDocPage;
