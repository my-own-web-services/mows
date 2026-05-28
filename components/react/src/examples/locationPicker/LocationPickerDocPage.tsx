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
import { locationPickerExampleById } from "./index";

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

const USAGE_SNIPPET = `import { LocationPicker, type PickedLocation } from "@my-own-web-services/react-components";
import { useState } from "react";

const [point, setPoint] = useState<PickedLocation | null>(null);

<LocationPicker value={point} onChange={setPoint} />`;

const COMPOSITION_SNIPPET = `// LocationPicker wraps <Map>: it reuses the active currentMapStyle
// from MowsContext and adds a click-to-pin handler. Picked coordinates
// surface via onChange (controlled) or are stored internally
// (uncontrolled via defaultValue).

<LocationPicker
    defaultValue={{ longitude: 10.45, latitude: 51.16 }}
    onChange={(p) => console.log(p)}
    initialView={{ longitude: 10.45, latitude: 51.16, zoom: 4 }}
    height={500}
    clearable
/>`;

const PROPS: PropRow[] = [
    { name: `value`, type: `PickedLocation | null`, default: `—`, description: `Controlled selection. Pass null to render the empty state.` },
    { name: `defaultValue`, type: `PickedLocation | null`, default: `null`, description: `Uncontrolled seed. Ignored once value is supplied.` },
    { name: `onChange`, type: `(next: PickedLocation | null) => void`, default: `—`, description: `Fires for every map click and when the clear button is pressed.` },
    { name: `initialView`, type: `MapView`, default: `world view`, description: `Initial camera. When a value is present the camera is centred on it instead.` },
    { name: `height`, type: `number | string`, default: `400`, description: `Fixed height for the embedded map.` },
    { name: `clearable`, type: `boolean`, default: `true`, description: `Show the clear-selection button next to the readout.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<LocationPickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.locationPicker;
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

const TEST_FILE = `lib/components/input/locationPicker/LocationPicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersMap, testFile: TEST_FILE, testName: `renders the map stub and the empty-state hint`, testLine: 123 },
    { statement: statements.uncontrolledClickUpdates, testFile: TEST_FILE, testName: `uncontrolled: a map click updates the internal value and shows the readout`, testLine: 133 },
    { statement: statements.controlledFiresOnChange, testFile: TEST_FILE, testName: `controlled: a map click fires onChange but leaves the visible value alone`, testLine: 142 },
    { statement: statements.clearResets, testFile: TEST_FILE, testName: `the Clear button resets the picked value to null`, testLine: 155 },
    { statement: statements.mountsMarker, testFile: TEST_FILE, testName: `mounts a pin marker on the map once the first value is set`, testLine: 170 }
];

export const LocationPickerDocPage = () => {
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
                            example={locationPickerExampleById(`default`)}
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
                <PropTable heading={`<LocationPicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default LocationPickerDocPage;
