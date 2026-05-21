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
import { compassExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    markers: `examples-markers`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Compass } from "mows-components-react";

<Compass heading={heading} />`;

const COMPOSITION_SNIPPET = `// Compass is a HUD-style horizontal bar. Drive heading from anything that
// exposes a yaw value (Image360Viewer onHeadingChange, a 3D controller,
// telemetry). Headings outside [0, 360) are normalised automatically.

<Compass
    heading={yaw}
    fieldOfView={60}        // zoom in: each pixel covers fewer degrees
    tickInterval={5}        // a tick every 5°, major ticks at multiples of 30°
    markers={[
        { bearing: 33,  label: "Goal" },
        { bearing: 200, label: "Camp" }
    ]}
    readout={null}          // hide the numeric readout
/>`;

const PROPS: PropRow[] = [
    {
        name: `heading`,
        type: `number`,
        default: `—`,
        description: `Required. Current yaw in degrees. Normalised modulo 360 so negative or > 360 values are fine.`
    },
    {
        name: `fieldOfView`,
        type: `number`,
        default: `120`,
        description: `Total horizontal field of view shown on the bar, in degrees. Smaller = more zoomed in.`
    },
    {
        name: `tickInterval`,
        type: `number`,
        default: `15`,
        description: `Tick spacing in degrees. Multiples of 30° render as major ticks.`
    },
    {
        name: `markers`,
        type: `CompassMarker[]`,
        default: `—`,
        description: `Extra labelled bearings (waypoints / POIs).`
    },
    {
        name: `hideCardinals`,
        type: `boolean`,
        default: `false`,
        description: `Hide the default N / E / S / W (+ NE / SE / SW / NW) labels.`
    },
    {
        name: `readout`,
        type: `ReactNode | null`,
        default: `auto`,
        description: `Numeric readout under the bar. Pass null to hide; pass any node to override.`
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

const MARKER_PROPS: PropRow[] = [
    { name: `bearing`, type: `number`, default: `—`, description: `Bearing in degrees (0 = North, increases clockwise).` },
    { name: `label`, type: `string`, default: `—`, description: `Short label rendered on the bar.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the marker label.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<CompassDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.compass;
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
                { id: ANCHOR.markers, label: doc.examples.markers.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/navigation/compass/Compass.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.defaultReadout,
        testFile: TEST_FILE,
        testName: `renders the default readout as integer degrees + cardinal direction`,
        testLine: 7
    },
    {
        statement: statements.normalisesNegative,
        testFile: TEST_FILE,
        testName: `normalises a negative heading into the 0-359° range`,
        testLine: 12
    },
    {
        statement: statements.normalisesLarge,
        testFile: TEST_FILE,
        testName: `normalises a heading > 360°`,
        testLine: 18
    },
    {
        statement: statements.mapsCardinal,
        testFile: TEST_FILE,
        testName: `maps headings near a cardinal to that cardinal direction`,
        testLine: 24
    },
    {
        statement: statements.cardinalsByDefault,
        testFile: TEST_FILE,
        testName: `renders cardinal labels (N / E / S / W) by default`,
        testLine: 29
    },
    {
        statement: statements.readoutNullHides,
        testFile: TEST_FILE,
        testName: `hides the readout when readout={null}`,
        testLine: 37
    },
    {
        statement: statements.customReadout,
        testFile: TEST_FILE,
        testName: `accepts a custom readout node`,
        testLine: 44
    },
    {
        statement: statements.rendersMarkers,
        testFile: TEST_FILE,
        testName: `renders extra markers passed via the markers prop`,
        testLine: 49
    },
    {
        statement: statements.hideCardinals,
        testFile: TEST_FILE,
        testName: `hideCardinals removes the default cardinal labels from the bar`,
        testLine: 59
    }
];

export const CompassDocPage = () => {
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
                            example={compassExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.markers}
                        title={doc.examples.markers.title}
                        description={doc.examples.markers.description}
                    >
                        <ExampleCard
                            example={compassExampleById(`markers`)}
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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<Compass>`} rows={PROPS} />
                    <PropTable heading={`CompassMarker`} rows={MARKER_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default CompassDocPage;
