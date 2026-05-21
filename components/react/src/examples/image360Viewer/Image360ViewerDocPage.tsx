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
import { image360ViewerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    switchImages: `examples-switch-images`,
    compassOverlay: `examples-compass-overlay`,
    virtualTour: `examples-virtual-tour`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Image360Viewer } from "mows-components-react";

<Image360Viewer src="/panorama.jpg" />`;

const COMPOSITION_SNIPPET = `// Image360Viewer wraps Photo Sphere Viewer with shadcn-friendly defaults
// (hidden navbar, no in-app loading indicator). Pair onHeadingChange with
// <Compass> to render a HUD-style yaw indicator.

const [yaw, setYaw] = useState(0);

<Image360Viewer src={url} onHeadingChange={setYaw} />
<Compass heading={yaw} />`;

const PROPS: PropRow[] = [
    { name: `src`, type: `string`, default: `—`, description: `Required. URL of the equirectangular panorama.` },
    { name: `alt`, type: `string`, default: `—`, description: `Accessible name for the viewer.` },
    { name: `navbar`, type: `boolean | string[]`, default: `false`, description: `Photo Sphere Viewer navbar — false hides it, true shows default, or pass an array of button ids.` },
    { name: `defaultZoomLvl`, type: `number`, default: `~50`, description: `Initial zoom level 0..100 (0 = widest, 100 = tightest).` },
    { name: `minFov`, type: `number`, default: `10`, description: `Tightest allowed field of view in degrees.` },
    { name: `maxFov`, type: `number`, default: `140`, description: `Widest allowed field of view in degrees.` },
    { name: `onHeadingChange`, type: `(degrees: number) => void`, default: `—`, description: `Fires whenever the viewer's yaw changes. Bearing in degrees [0, 360), ready to feed straight into <Compass>.` },
    { name: `markers`, type: `ReadonlyArray<Image360ViewerMarker>`, default: `—`, description: `Markers / hotspots / waypoints overlaid on the sphere. HTML markers, image markers, polygon overlays, and tooltips are all supported. Updating the prop diff-replaces the live set via setMarkers — perfect for virtual-tour scene swaps.` },
    { name: `onMarkerClick`, type: `(marker: Image360ViewerMarker) => void`, default: `—`, description: `Fires on any marker click. Use the marker's data payload to route, swap scenes, or open an info panel.` },
    { name: `smoothTransitions`, type: `boolean`, default: `false`, description: `Re-enable Photo Sphere Viewer's post-drag inertial glide. Default false produces snappier 1:1 pointer→yaw mapping.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) throw new Error(`<Image360ViewerDocPage> must be rendered inside <MowsProvider>`);
    return ctx.t.example.examples.image360Viewer;
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
                {
                    id: ANCHOR.switchImages,
                    label: doc.examples.switchImages.title
                },
                {
                    id: ANCHOR.compassOverlay,
                    label: doc.examples.compassOverlay.title
                },
                {
                    id: ANCHOR.virtualTour,
                    label: doc.examples.virtualTour.title
                }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/files/fileViewer/formats/image360Viewer/Image360Viewer.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.mountsViewer, testFile: TEST_FILE, testName: `mounts a Photo Sphere Viewer with the given src`, testLine: 47 },
    { statement: statements.subscribesPosition, testFile: TEST_FILE, testName: `subscribes to PSV "position-updated" to forward heading changes`, testLine: 55 },
    { statement: statements.noLoadingIndicator, testFile: TEST_FILE, testName: `renders no loading indicator while the panorama loads`, testLine: 61 },
    { statement: statements.forwardsClassName, testFile: TEST_FILE, testName: `forwards className onto the outer wrapper`, testLine: 75 },
    { statement: statements.forwardsStyle, testFile: TEST_FILE, testName: `forwards inline style onto the wrapper`, testLine: 84 }
];

export const Image360ViewerDocPage = () => {
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
                        <ExampleCard example={image360ViewerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.switchImages}
                        title={doc.examples.switchImages.title}
                        description={doc.examples.switchImages.description}
                    >
                        <ExampleCard
                            example={image360ViewerExampleById(`switchImages`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.compassOverlay}
                        title={doc.examples.compassOverlay.title}
                        description={doc.examples.compassOverlay.description}
                    >
                        <ExampleCard
                            example={image360ViewerExampleById(`compassOverlay`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.virtualTour}
                        title={doc.examples.virtualTour.title}
                        description={doc.examples.virtualTour.description}
                    >
                        <ExampleCard
                            example={image360ViewerExampleById(`virtualTour`)}
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
                <PropTable heading={`<Image360Viewer>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default Image360ViewerDocPage;
