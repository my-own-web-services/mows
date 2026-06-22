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
import { iconBadgeExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    positions: `examples-positions`,
    patterns: `examples-patterns`,
    filled: `examples-filled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { IconBadge } from "@my-own-web-services/react-components";
import { Cloud, File } from "lucide-react";

<IconBadge
    size={48}
    icon={<File className="h-12 w-12" />}
    badge={<Cloud className="h-4 w-4" />}
/>`;

const COMPOSITION_SNIPPET = `// badgePosition picks the corner OR edge midpoint to anchor at.
// badgeClassName opts into a coloured fill — the mask still cuts the
// primary icon out behind the fill, so the edge stays crisp.

<IconBadge
    size={56}
    badgePosition="top-right"
    badgeFraction={0.45}
    icon={<User className="h-14 w-14" />}
    badge={<Check className="h-3.5 w-3.5 text-white" />}
    badgeClassName="bg-emerald-500"
/>`;

const PROPS: PropRow[] = [
    { name: `icon`, type: `ReactNode`, default: `—`, description: `Primary icon. Size it via its own props (e.g. h-12 w-12 on a lucide icon).` },
    { name: `badge`, type: `ReactNode`, default: `—`, description: `Sub-icon shown at the anchor. Caller-sized.` },
    { name: `size`, type: `number`, default: `32`, description: `Outer layout size in pixels.` },
    { name: `badgeFraction`, type: `number`, default: `0.5`, description: `Cutout circle diameter as a fraction of size. Raise it for a roomier badge, lower for a tighter status dot.` },
    { name: `badgePosition`, type: `IconBadgePosition`, default: `"bottom-right"`, description: `Anchor: one of the four corners or the four edge midpoints (top, right, bottom, left).` },
    { name: `badgeGap`, type: `number`, default: `2`, description: `Extra cut radius beyond the badge wrapper, in pixels. Opens a visible margin between the badge sub-icon and the primary icon's strokes.` },
    { name: `badgeClassName`, type: `string`, default: `—`, description: `Tailwind classes on the badge wrapper. No border or background by default; opt into a filled disc here.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<IconBadgeDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.iconBadge;
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
                { id: ANCHOR.positions, label: doc.examples.positions.title },
                { id: ANCHOR.patterns, label: doc.examples.patterns.title },
                { id: ANCHOR.filled, label: doc.examples.filled.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/display/iconBadge/IconBadge.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersBothIcons,
        testFile: TEST_FILE,
        testName: `renders both the primary icon and the badge sub-icon`,
        testLine: 11
    },
    {
        statement: statements.punchesMaskHole,
        testFile: TEST_FILE,
        testName: `applies a radial-gradient mask to the primary icon wrapper for a genuinely transparent cutout`,
        testLine: 22
    },
    {
        statement: statements.noDefaultOutline,
        testFile: TEST_FILE,
        testName: `renders without a border or background fill on the visible badge wrapper`,
        testLine: 29
    },
    {
        statement: statements.badgeSizeFromFraction,
        testFile: TEST_FILE,
        testName: `derives the badge size from badgeFraction`,
        testLine: 45
    },
    {
        statement: statements.cornerAnchoring,
        testFile: TEST_FILE,
        testName: `anchors the badge to bottom-right by default`,
        testLine: 59
    },
    {
        statement: statements.edgeAnchoring,
        testFile: TEST_FILE,
        testName: `anchors the badge to the %s edge midpoint with the matching side flush and the orthogonal axis centred`,
        testLine: 89
    },
    {
        statement: statements.badgeClassNameOverrides,
        testFile: TEST_FILE,
        testName: `forwards a custom badgeClassName to the visible badge container`,
        testLine: 137
    },
    {
        statement: statements.badgeGapShiftsRadius,
        testFile: TEST_FILE,
        testName: `grows the cut radius by badgeGap so the mask sits clearly outside the badge wrapper`,
        testLine: 149
    }
];

export const IconBadgeDocPage = () => {
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
                            example={iconBadgeExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.positions}
                        title={doc.examples.positions.title}
                        description={doc.examples.positions.description}
                    >
                        <ExampleCard
                            example={iconBadgeExampleById(`positions`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.patterns}
                        title={doc.examples.patterns.title}
                        description={doc.examples.patterns.description}
                    >
                        <ExampleCard
                            example={iconBadgeExampleById(`patterns`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.filled}
                        title={doc.examples.filled.title}
                        description={doc.examples.filled.description}
                    >
                        <ExampleCard
                            example={iconBadgeExampleById(`filled`)}
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
                <div dir={`rtl`}>
                    <ExampleCard example={iconBadgeExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<IconBadge>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default IconBadgeDocPage;
