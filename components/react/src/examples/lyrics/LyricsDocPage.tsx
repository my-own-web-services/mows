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
import { lyricsExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    basic: `examples-basic`,
    compact: `examples-compact`,
    karaoke: `examples-karaoke`,
    synced: `examples-synced`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Lyrics } from "@my-own-web-services/react-components";

<Lyrics
    source={lrcString}
    currentTime={audio.currentTime}
    onSeek={(s) => { audio.currentTime = s; }}
/>`;

const COMPOSITION_SNIPPET = `// Recommended: pair Lyrics with the library's <AudioPlayer>. The
// imperative AudioPlayerHandle.seekTo() drives the audio when a line
// is clicked, and onTimeUpdate feeds the active-line tracking.
import {
    AudioPlayer,
    Lyrics,
    type AudioPlayerHandle
} from "@my-own-web-services/react-components";

const Player = () => {
    const playerRef = useRef<AudioPlayerHandle>(null);
    const [time, setTime] = useState(0);

    return (
        <>
            <AudioPlayer
                ref={playerRef}
                src={url}
                onTimeUpdate={setTime}
            />
            <Lyrics
                source={lrc}
                currentTime={time}
                onSeek={(s) => playerRef.current?.seekTo(s)}
            />
        </>
    );
};

// Alternative: drive Lyrics from a raw <audio> element if you don't
// need the <AudioPlayer> chrome.
const RawAudioPlayer = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [time, setTime] = useState(0);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onTime = () => setTime(el.currentTime);
        el.addEventListener("timeupdate", onTime);
        return () => el.removeEventListener("timeupdate", onTime);
    }, []);

    return (
        <>
            <Lyrics
                source={lrc}
                currentTime={time}
                onSeek={(s) => {
                    if (audioRef.current) audioRef.current.currentTime = s;
                }}
            />
            <audio ref={audioRef} src={url} />
        </>
    );
};

// Pre-parse once when the same lyrics render in many places — avoids
// rerunning the parser on every render.
import { parseLrc } from "@my-own-web-services/react-components";
const parsed = parseLrc(lrc);
<Lyrics source={parsed} currentTime={time} />`;

const LYRICS_PROPS: PropRow[] = [
    {
        name: `source`,
        type: `string | ParsedLyrics`,
        default: `—`,
        description: `Required. Raw LRC-formatted string or a pre-parsed value from \`parseLrc()\`. Pre-parse when the same lyric renders in many places.`
    },
    {
        name: `currentTime`,
        type: `number`,
        default: `—`,
        description: `Required. Playback time in seconds. Recommended: wire it to \`<AudioPlayer>\`'s \`onTimeUpdate\` callback. Alternatively drive from a raw \`<audio>\` element's \`timeupdate\` handler, an external scrubber, or any clock.`
    },
    {
        name: `variant`,
        type: `"scrolling" | "compact"`,
        default: `"scrolling"`,
        description: `The scrolling variant keeps the active line centred and fades inactive lines with distance; the compact variant skips auto-scroll and renders every line at full opacity.`
    },
    {
        name: `onSeek`,
        type: `(seconds: number) => void`,
        default: `—`,
        description: `When provided, lines become click targets that call back with the line's start time. Recommended: forward to \`AudioPlayerHandle.seekTo()\` via a ref on \`<AudioPlayer>\`. Alternatively assign to a raw \`<audio>\` element's \`currentTime\`.`
    },
    {
        name: `autoScroll`,
        type: `boolean`,
        default: `true`,
        description: `Override the auto-scroll behaviour of the scrolling variant. Set to false to keep the layout still while the active line continues to highlight.`
    },
    {
        name: `header`,
        type: `ReactNode`,
        default: `metadata title + artist`,
        description: `Rendered above the lines. Defaults to the parsed \`[ti:]\` / \`[ar:]\` metadata. Pass \`null\` to suppress entirely.`
    },
    {
        name: `emptyState`,
        type: `ReactNode`,
        default: `translated "No lyrics"`,
        description: `Replaces the fallback shown when the source contains no usable lines.`
    },
    {
        name: `strings`,
        type: `Partial<LyricsStrings>`,
        default: `English defaults`,
        description: `Translation overrides for the empty state, the "Seek to line" aria-label, and the default region label.`
    },
    {
        name: `ariaLabel`,
        type: `string`,
        default: `metadata.title ?? "Lyrics"`,
        description: `\`aria-label\` for the outer region. Falls back to the parsed title, then the translated default.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged onto the root container.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style forwarded to the root container.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<LyricsDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.lyrics;
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
                { id: ANCHOR.basic, label: doc.examples.basic.title },
                { id: ANCHOR.compact, label: doc.examples.compact.title },
                { id: ANCHOR.karaoke, label: doc.examples.karaoke.title },
                { id: ANCHOR.synced, label: doc.examples.synced.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/files/lyrics/Lyrics.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.parsesMetadata,
        testFile: TEST_FILE,
        testName: `parses metadata tags`,
        testLine: 81
    },
    {
        statement: statements.expandsRepeats,
        testFile: TEST_FILE,
        testName: `expands repeated timestamps into separate lines`,
        testLine: 103
    },
    {
        statement: statements.karaokeWords,
        testFile: TEST_FILE,
        testName: `parses enhanced LRC karaoke timings into words`,
        testLine: 110
    },
    {
        statement: statements.appliesOffset,
        testFile: TEST_FILE,
        testName: `applies the [offset:ms] correction`,
        testLine: 123
    },
    {
        statement: statements.activeIndex,
        testFile: TEST_FILE,
        testName: `returns the line whose start is the largest <= time`,
        testLine: 148
    },
    {
        statement: statements.seekOnClick,
        testFile: TEST_FILE,
        testName: `fires onSeek when a line is clicked`,
        testLine: 256
    },
    {
        statement: statements.seekOnEnter,
        testFile: TEST_FILE,
        testName: `fires onSeek on Enter when focused`,
        testLine: 276
    },
    {
        statement: statements.emptySource,
        testFile: TEST_FILE,
        testName: `shows the empty state when the source has no lines`,
        testLine: 238
    },
    {
        statement: statements.noClickWithoutSeek,
        testFile: TEST_FILE,
        testName: `does not wire click handlers when onSeek is omitted`,
        testLine: 267
    },
    {
        statement: statements.preparsed,
        testFile: TEST_FILE,
        testName: `accepts a pre-parsed ParsedLyrics value`,
        testLine: 297
    }
];

export const LyricsDocPage = () => {
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
                        id={ANCHOR.basic}
                        title={doc.examples.basic.title}
                        description={doc.examples.basic.description}
                    >
                        <ExampleCard example={lyricsExampleById(`basic`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.compact}
                        title={doc.examples.compact.title}
                        description={doc.examples.compact.description}
                    >
                        <ExampleCard example={lyricsExampleById(`compact`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.karaoke}
                        title={doc.examples.karaoke.title}
                        description={doc.examples.karaoke.description}
                    >
                        <ExampleCard example={lyricsExampleById(`karaoke`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.synced}
                        title={doc.examples.synced.title}
                        description={doc.examples.synced.description}
                    >
                        <ExampleCard example={lyricsExampleById(`synced`)} hideHeader />
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard example={lyricsExampleById(`rtl`)} hideHeader />
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
                <PropTable heading={`<Lyrics>`} rows={LYRICS_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default LyricsDocPage;
