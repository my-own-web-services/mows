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
import { colorCurvesExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    photo: `examples-photo`,
    standalone: `examples-standalone`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import {
    ColorCurves,
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesValue
} from "@mows/react-components";

const [value, setValue] = useState<ColorCurvesValue>(
    DEFAULT_COLOR_CURVES_VALUE
);

<ColorCurves value={value} onChange={setValue} />`;

const COMPOSITION_SNIPPET = `import {
    ColorCurves,
    applyColorCurvesToImageData,
    computeColorCurvesHistogram,
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesValue
} from "@mows/react-components";

// 1. Load the source image into an ImageData once.
const source = await loadImageData("/photo.jpg");
const histogram = computeColorCurvesHistogram(source);

// 2. Apply the curves to a fresh copy on every change.
useEffect(() => {
    const working = new ImageData(
        new Uint8ClampedArray(source.data),
        source.width,
        source.height
    );
    applyColorCurvesToImageData(working, value);
    canvasRef.current!.getContext("2d")!.putImageData(working, 0, 0);
}, [source, value]);

<ColorCurves
    value={value}
    onChange={setValue}
    histogram={histogram}
/>`;

interface PropDescriptions {
    readonly value: string;
    readonly onChange: string;
    readonly channel: string;
    readonly onChannelChange: string;
    readonly histogram: string;
    readonly showHistogram: string;
    readonly size: string;
    readonly disabled: string;
    readonly hideResetAll: string;
    readonly strings: string;
    readonly ariaLabel: string;
}

const buildPropRows = (d: PropDescriptions): PropRow[] => [
    { name: `value`, type: `ColorCurvesValue`, default: `—`, description: d.value },
    {
        name: `onChange`,
        type: `(value: ColorCurvesValue) => void`,
        default: `—`,
        description: d.onChange
    },
    {
        name: `channel`,
        type: `"rgb" | "r" | "g" | "b"`,
        default: `internal`,
        description: d.channel
    },
    {
        name: `onChannelChange`,
        type: `(channel) => void`,
        default: `—`,
        description: d.onChannelChange
    },
    {
        name: `histogram`,
        type: `ColorCurvesHistogram`,
        default: `—`,
        description: d.histogram
    },
    { name: `showHistogram`, type: `boolean`, default: `true`, description: d.showHistogram },
    { name: `size`, type: `number`, default: `320`, description: d.size },
    { name: `disabled`, type: `boolean`, default: `false`, description: d.disabled },
    { name: `hideResetAll`, type: `boolean`, default: `false`, description: d.hideResetAll },
    {
        name: `strings`,
        type: `Partial<ColorCurvesStrings>`,
        default: `—`,
        description: d.strings
    },
    {
        name: `ariaLabel`,
        type: `string`,
        default: `"Color curves editor"`,
        description: d.ariaLabel
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<ColorCurvesDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.colorCurves;
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
                { id: ANCHOR.photo, label: doc.examples.photo.title },
                { id: ANCHOR.standalone, label: doc.examples.standalone.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/input/colorCurves/ColorCurves.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersSurface,
        testFile: TEST_FILE,
        testName: `renders the SVG curve editing surface`,
        testLine: 40
    },
    {
        statement: statements.rendersChannelButtons,
        testFile: TEST_FILE,
        testName: `renders one channel tab per RGB/R/G/B channel`,
        testLine: 51
    },
    {
        statement: statements.channelClickSwitches,
        testFile: TEST_FILE,
        testName: `clicking a channel tab switches the active channel`,
        testLine: 67
    },
    {
        statement: statements.resetChannelRestoresIdentity,
        testFile: TEST_FILE,
        testName: `reset channel button restores the active channel to the identity curve`,
        testLine: 84
    },
    {
        statement: statements.resetAllRestoresIdentity,
        testFile: TEST_FILE,
        testName: `reset all button restores every channel to the identity curve`,
        testLine: 106
    },
    {
        statement: statements.clickAddsPoint,
        testFile: TEST_FILE,
        testName: `clicking empty space on the surface adds a control point`,
        testLine: 124
    },
    {
        statement: statements.deleteRemovesPoint,
        testFile: TEST_FILE,
        testName: `pressing Delete on a focused non-endpoint point removes it`,
        testLine: 162
    },
    {
        statement: statements.disabledPreventsInput,
        testFile: TEST_FILE,
        testName: `disabled prop hides pointer interaction and disables the action buttons`,
        testLine: 191
    }
];

export const ColorCurvesDocPage = () => {
    const t = useDocStrings();
    const doc = t.doc;
    const indexItems = React.useMemo(() => buildIndexItems(t), [t]);
    const behaviourEntries = React.useMemo(
        () => buildBehaviourEntries(doc.definedBehaviour.statements),
        [doc.definedBehaviour.statements]
    );
    const propRows = React.useMemo(
        () => buildPropRows(doc.apiReference.props),
        [doc.apiReference.props]
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
                        id={ANCHOR.photo}
                        title={doc.examples.photo.title}
                        description={doc.examples.photo.description}
                    >
                        <ExampleCard
                            example={colorCurvesExampleById(`photo`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.standalone}
                        title={doc.examples.standalone.title}
                        description={doc.examples.standalone.description}
                    >
                        <ExampleCard
                            example={colorCurvesExampleById(`standalone`)}
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
                    <CodeViewer
                        code={COMPOSITION_SNIPPET}
                        language={`tsx`}
                        fitContent
                    />
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
                <PropTable heading={`<ColorCurves>`} rows={propRows} />
            </DocSection>
        </DocPage>
    );
};

export default ColorCurvesDocPage;
