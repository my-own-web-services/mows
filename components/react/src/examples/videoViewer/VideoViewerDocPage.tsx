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
import { videoViewerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    dash: `examples-dash`,
    hls: `examples-hls`,
    chapters: `examples-chapters`,
    controls: `examples-controls`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react shaka-player`;

const USAGE_SNIPPET = `import VideoViewer from "mows-components-react/components/files/fileViewer/formats/videoViewer/VideoViewer";

<VideoViewer
    src="https://example.com/video.mp4"
    mimeType="video/mp4"
    name="My clip"
/>`;

const COMPOSITION_SNIPPET = `// VideoViewer is the format dispatched by <FileViewer> for any video/* mime
// type or DASH/HLS manifest. Typical usage is via <FileViewer>, which lazy-
// loads VideoViewer behind a Suspense boundary so non-video callers don't
// pay the ~256 kB shaka-player cost.

<FileViewer
    src={resolveVideoUrl(file)}
    mimeType={file.mimeType}
    name={file.name}
/>

// Direct usage works too — render it inside a sized container.
<div className="aspect-video w-full max-w-3xl">
    <VideoViewer src={src} mimeType="application/dash+xml" name="Stream" />
</div>`;

const VIDEO_VIEWER_PROPS: PropRow[] = [
    {
        name: `src`,
        type: `string`,
        default: `(required)`,
        description: `Resolved URL of a video file or DASH/HLS manifest.`
    },
    {
        name: `mimeType`,
        type: `string`,
        default: `(required)`,
        description: `Drives behaviour and is rendered into the aria-label. video/*, application/dash+xml, application/vnd.apple.mpegurl, …`
    },
    {
        name: `name`,
        type: `string`,
        default: `—`,
        description: `Surface name; used as the wrapper's aria-label.`
    },
    {
        name: `autoplay`,
        type: `boolean`,
        default: `false`,
        description: `Pair with muted for muted-autoplay friendliness on Chrome/Safari.`
    },
    {
        name: `muted`,
        type: `boolean`,
        default: `false`,
        description: `Initial muted state.`
    },
    {
        name: `loop`,
        type: `boolean`,
        default: `false`,
        description: `Loop playback when the clip ends.`
    },
    {
        name: `poster`,
        type: `string`,
        default: `—`,
        description: `Forwarded to <video poster>.`
    },
    {
        name: `strings`,
        type: `Partial<VideoViewerStrings>`,
        default: `—`,
        description: `Override built-in English labels (aria + tooltips).`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the wrapper <div>.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Extra inline styles on the wrapper <div>.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<VideoViewerDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.videoViewer;
};

type VideoViewerStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: VideoViewerStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.dash, label: doc.examples.dash.title },
                { id: ANCHOR.hls, label: doc.examples.hls.title },
                { id: ANCHOR.chapters, label: doc.examples.chapters.title },
                { id: ANCHOR.controls, label: doc.examples.controls.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const COMPONENT_TEST_FILE = `lib/components/files/fileViewer/formats/videoViewer/VideoViewer.test.tsx`;
const DISPATCH_TEST_FILE = `lib/components/files/fileViewer/FileViewer.test.tsx`;
const MIMETYPE_TEST_FILE = `lib/components/files/fileViewer/formats/videoViewer/mimeType.test.ts`;
const KEYBOARD_TEST_FILE = `lib/components/files/fileViewer/formats/videoViewer/keyboard.test.ts`;

const buildBehaviourEntries = (
    statements: VideoViewerStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.dispatchByMime,
        testFile: DISPATCH_TEST_FILE,
        testName: `renders VideoViewer for any video/* mime type`,
        testLine: 48
    },
    {
        statement: statements.dispatchManifest,
        testFile: DISPATCH_TEST_FILE,
        testName: `renders VideoViewer for DASH and HLS manifest mime types`,
        testLine: 56
    },
    {
        statement: statements.recognisesManifests,
        testFile: MIMETYPE_TEST_FILE,
        testName: `is true for video/* or any streaming manifest`,
        testLine: 39
    },
    {
        statement: statements.constructsOnePlayer,
        testFile: COMPONENT_TEST_FILE,
        testName: `installs Shaka polyfills and constructs one Player per mount`,
        testLine: 88
    },
    {
        statement: statements.nativeFallback,
        testFile: COMPONENT_TEST_FILE,
        testName: `uses native <video controls> when Shaka is not supported`,
        testLine: 101
    },
    {
        statement: statements.reusesOnSrcChange,
        testFile: COMPONENT_TEST_FILE,
        testName: `re-uses the same Player when src changes and calls load() again`,
        testLine: 115
    },
    {
        statement: statements.cleansUpOnUnmount,
        testFile: COMPONENT_TEST_FILE,
        testName: `destroys the Player on unmount`,
        testLine: 135
    },
    {
        statement: statements.keyboardTogglePlay,
        testFile: KEYBOARD_TEST_FILE,
        testName: `maps space and k to togglePlay`,
        testLine: 14
    },
    {
        statement: statements.keyboardModifierGuard,
        testFile: KEYBOARD_TEST_FILE,
        testName: `returns null when modifier keys are held (browser shortcuts win)`,
        testLine: 45
    }
];

export const VideoViewerDocPage = () => {
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
                        id={ANCHOR.default}
                        title={doc.examples.default.title}
                        description={doc.examples.default.description}
                    >
                        <ExampleCard
                            example={videoViewerExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.dash}
                        title={doc.examples.dash.title}
                        description={doc.examples.dash.description}
                    >
                        <ExampleCard example={videoViewerExampleById(`dash`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.hls}
                        title={doc.examples.hls.title}
                        description={doc.examples.hls.description}
                    >
                        <ExampleCard example={videoViewerExampleById(`hls`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.chapters}
                        title={doc.examples.chapters.title}
                        description={doc.examples.chapters.description}
                    >
                        <ExampleCard
                            example={videoViewerExampleById(`chapters`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.controls}
                        title={doc.examples.controls.title}
                        description={doc.examples.controls.description}
                    >
                        <ExampleCard
                            example={videoViewerExampleById(`controls`)}
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
                <PropTable heading={`<VideoViewer>`} rows={VIDEO_VIEWER_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default VideoViewerDocPage;
