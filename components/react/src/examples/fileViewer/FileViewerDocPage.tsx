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
import { fileViewerExampleById } from "./index";

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

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { FileViewer } from "@mows/react-components";

<FileViewer
    src={url}
    name={fileName}
    mimeType={mimeType}
/>`;

const COMPOSITION_SNIPPET = `// FileViewer dispatches on mimeType: image/* → <ImageViewer>; video/* +
// DASH/HLS manifests → <VideoViewer>; image/* with is360 → <Image360Viewer>.
// The 360 and video viewers lazy-load — consumers without panoramas / video
// don't pay the chunk cost.

<FileViewer src={url} name="pano.jpg" mimeType="image/jpeg" is360 />
<FileViewer src={url} name="stream.m3u8" mimeType="application/x-mpegURL" />

// Fallback for unknown mime types:
<FileViewer
    src={url}
    name={file.name}
    mimeType={file.mimeType}
    fallback={<DownloadLink href={url} />}
/>`;

const PROPS: PropRow[] = [
    { name: `src`, type: `string`, default: `—`, description: `Required. Resolved URL to the file (consumer resolves auth / signing / etc.).` },
    { name: `name`, type: `string`, default: `—`, description: `Required. File name. Used as alt text and as the default fallback.` },
    { name: `mimeType`, type: `string`, default: `—`, description: `Required. Drives the inner viewer selection.` },
    { name: `width`, type: `number`, default: `—`, description: `Forwarded onto <ImageViewer> for non-360 images.` },
    { name: `height`, type: `number`, default: `—`, description: `Forwarded onto <ImageViewer> for non-360 images.` },
    { name: `is360`, type: `boolean`, default: `false`, description: `Render an image/* as a 360° equirectangular panorama. Detection is the consumer's responsibility.` },
    { name: `fallback`, type: `ReactNode`, default: `name`, description: `Custom fallback when no built-in viewer matches.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<FileViewerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.fileViewer;
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
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/files/fileViewer/FileViewer.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.imageViewer, testFile: TEST_FILE, testName: `renders ImageViewer for image/* without is360`, testLine: 30 },
    { statement: statements.image360Viewer, testFile: TEST_FILE, testName: `renders Image360Viewer for image/* when is360 is true`, testLine: 39 },
    { statement: statements.videoViewer, testFile: TEST_FILE, testName: `renders VideoViewer for any video/* mime type`, testLine: 48 },
    { statement: statements.dashHls, testFile: TEST_FILE, testName: `renders VideoViewer for DASH and HLS manifest mime types`, testLine: 56 },
    { statement: statements.nameFallback, testFile: TEST_FILE, testName: `falls back to the name when no viewer matches`, testLine: 81 },
    { statement: statements.customFallback, testFile: TEST_FILE, testName: `renders the explicit fallback when provided and nothing matches`, testLine: 102 }
];

export const FileViewerDocPage = () => {
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
                        <ExampleCard example={fileViewerExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<FileViewer>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default FileViewerDocPage;
