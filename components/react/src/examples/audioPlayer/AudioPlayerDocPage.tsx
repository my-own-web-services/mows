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
import { audioPlayerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    bar: `examples-bar`,
    card: `examples-card`,
    minimal: `examples-minimal`,
    peaks: `examples-peaks`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { AudioPlayer } from "@mows/react-components";

<AudioPlayer src="https://cdn.example.com/track.mp3" />`;

const COMPOSITION_SNIPPET = `// Card variant — pass title, subtitle, and artwork for the hero layout.
<AudioPlayer
    variant="card"
    title="Forest, Morning"
    subtitle="Field recording · ambient"
    artwork="https://cdn.example.com/cover.jpg"
    src="https://cdn.example.com/track.mp3"
/>

// Provide your own waveform peaks (values in [0, 1]) when you have
// pre-computed analysis from the server — otherwise the player generates
// a deterministic procedural waveform keyed off the source URL.
<AudioPlayer src={url} peaks={analysedPeaks} />`;

const AUDIO_PLAYER_PROPS: PropRow[] = [
    {
        name: `src`,
        type: `string`,
        default: `—`,
        description: `Required. Resolved audio URL. The consumer is responsible for any token / signed-URL resolution.`
    },
    {
        name: `variant`,
        type: `"bar" | "card" | "minimal"`,
        default: `"bar"`,
        description: `Visual layout. The bar is a compact pill with a procedural waveform; the card is a hero layout with artwork + metadata stacked over a taller waveform; the minimal variant drops the waveform in favour of a plain slider for dense contexts.`
    },
    {
        name: `title`,
        type: `string`,
        default: `—`,
        description: `Track title (card variant). Truncated with a tooltip when it overflows.`
    },
    {
        name: `subtitle`,
        type: `string`,
        default: `—`,
        description: `Secondary label (card variant) — artist, podcast name, recording context.`
    },
    {
        name: `artwork`,
        type: `string`,
        default: `—`,
        description: `Image URL shown on the card variant's left. Hidden in the bar variant.`
    },
    {
        name: `peaks`,
        type: `ReadonlyArray<number>`,
        default: `—`,
        description: `Pre-computed waveform peaks in [0, 1]. When omitted a deterministic procedural waveform is derived from the source URL so each track gets its own visual fingerprint.`
    },
    {
        name: `autoPlay`,
        type: `boolean`,
        default: `false`,
        description: `Autoplay on mount. Browsers require muted autoplay; non-muted sources may be rejected.`
    },
    {
        name: `loop`,
        type: `boolean`,
        default: `false`,
        description: `Loop playback when the source ends.`
    },
    {
        name: `preload`,
        type: `"none" | "metadata" | "auto"`,
        default: `"metadata"`,
        description: `Forwarded to the underlying <audio> element. "metadata" is enough to populate the duration without paying for the full byte stream.`
    },
    {
        name: `crossOrigin`,
        type: `"anonymous" | "use-credentials"`,
        default: `—`,
        description: `Forwarded to <audio crossOrigin>. Set when the source must support range requests across origins.`
    },
    {
        name: `downloadable`,
        type: `boolean`,
        default: `true`,
        description: `Show the download icon in the trailing action group.`
    },
    {
        name: `downloadName`,
        type: `string`,
        default: `—`,
        description: `Filename suggestion forwarded to the download anchor.`
    },
    {
        name: `strings`,
        type: `Partial<AudioPlayerStrings>`,
        default: `English defaults`,
        description: `Translation overrides for every visible affordance (Play, Pause, Mute, Seek, etc.).`
    },
    {
        name: `trailing`,
        type: `ReactNode`,
        default: `—`,
        description: `Optional slot rendered to the right of the timestamp (bar) or under the subtitle (card). Useful for badges or chips.`
    },
    {
        name: `onPlay`,
        type: `() => void`,
        default: `—`,
        description: `Fires when the audio element starts playing.`
    },
    {
        name: `onPause`,
        type: `() => void`,
        default: `—`,
        description: `Fires when playback pauses.`
    },
    {
        name: `onEnded`,
        type: `() => void`,
        default: `—`,
        description: `Fires when the source finishes playing.`
    },
    {
        name: `onTimeUpdate`,
        type: `(currentTime, duration) => void`,
        default: `—`,
        description: `Fires on every timeupdate; useful for syncing transcripts or external scrubbers.`
    },
    {
        name: `onError`,
        type: `(error: MediaError | null) => void`,
        default: `—`,
        description: `Fires when the underlying <audio> emits an error. The inline error row stays visible until the user retries.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<AudioPlayerDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.audioPlayer;
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
                { id: ANCHOR.bar, label: doc.examples.bar.title },
                { id: ANCHOR.card, label: doc.examples.card.title },
                { id: ANCHOR.minimal, label: doc.examples.minimal.title },
                { id: ANCHOR.peaks, label: doc.examples.peaks.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/files/audioPlayer/AudioPlayer.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.defaultBar,
        testFile: TEST_FILE,
        testName: `renders the bar variant by default`,
        testLine: 61
    },
    {
        statement: statements.cardVariant,
        testFile: TEST_FILE,
        testName: `renders the card variant when variant="card"`,
        testLine: 68
    },
    {
        statement: statements.playPauseToggle,
        testFile: TEST_FILE,
        testName: `shows Play when paused and Pause when playing`,
        testLine: 78
    },
    {
        statement: statements.muteToggle,
        testFile: TEST_FILE,
        testName: `clicking mute toggles the audio element's muted flag`,
        testLine: 102
    },
    {
        statement: statements.durationLoad,
        testFile: TEST_FILE,
        testName: `renders the duration once metadata is loaded`,
        testLine: 114
    },
    {
        statement: statements.keyboardSpace,
        testFile: TEST_FILE,
        testName: `Space key on the root toggles playback`,
        testLine: 124
    },
    {
        statement: statements.keyboardSkip,
        testFile: TEST_FILE,
        testName: `ArrowRight skips forward by the seek step`,
        testLine: 140
    },
    {
        statement: statements.errorAlert,
        testFile: TEST_FILE,
        testName: `surfaces an error row when the media element emits error`,
        testLine: 194
    },
    {
        statement: statements.peaksOverride,
        testFile: TEST_FILE,
        testName: `uses provided peaks instead of the procedural waveform`,
        testLine: 207
    }
];

export const AudioPlayerDocPage = () => {
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
                        id={ANCHOR.bar}
                        title={doc.examples.bar.title}
                        description={doc.examples.bar.description}
                    >
                        <ExampleCard example={audioPlayerExampleById(`bar`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.card}
                        title={doc.examples.card.title}
                        description={doc.examples.card.description}
                    >
                        <ExampleCard example={audioPlayerExampleById(`card`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.minimal}
                        title={doc.examples.minimal.title}
                        description={doc.examples.minimal.description}
                    >
                        <ExampleCard example={audioPlayerExampleById(`minimal`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.peaks}
                        title={doc.examples.peaks.title}
                        description={doc.examples.peaks.description}
                    >
                        <ExampleCard example={audioPlayerExampleById(`peaks`)} hideHeader />
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
                <ExampleCard example={audioPlayerExampleById(`rtl`)} hideHeader />
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
                <PropTable heading={`<AudioPlayer>`} rows={AUDIO_PLAYER_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default AudioPlayerDocPage;
