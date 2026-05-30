import { useState } from "react";
import AudioPlayer from "../../../lib/components/files/audioPlayer/AudioPlayer";
import { Button } from "../../../lib/components/ui/button";

// Public-domain samples hosted by archive.org / mozilla. Two contrasting
// tracks are useful: a short ambient piece and a longer spoken-word piece,
// so a reader sees the procedural waveform shape differ meaningfully
// between the two.
const SAMPLES = [
    {
        id: `birds`,
        title: `Forest, Morning`,
        subtitle: `Field recording · ambient`,
        artwork:
            `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=320&q=80`,
        // SoundHelix sample 1 — long-standing free testing mp3, ~6 min.
        src: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`
    },
    {
        id: `synth`,
        title: `Late Drive`,
        subtitle: `Synth · 5:39`,
        artwork:
            `https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=320&q=80`,
        src: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3`
    }
];

export const AudioPlayerDemoPage = () => {
    const [activeId, setActiveId] = useState(SAMPLES[0]!.id);
    const active = SAMPLES.find((s) => s.id === activeId) ?? SAMPLES[0]!;

    return (
        <div className={`mx-auto flex w-full max-w-3xl flex-col gap-10 py-8`}>
            <header className={`flex flex-col gap-2`}>
                <p className={`text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase`}>
                    Files · Media
                </p>
                <h1 className={`text-3xl font-semibold tracking-tight`}>
                    AudioPlayer
                </h1>
                <p className={`max-w-prose text-sm text-muted-foreground`}>
                    A compact <code className={`rounded bg-muted px-1 py-0.5 text-xs`}>bar</code> player
                    for lists and inline embeds, plus a larger
                    <code className={`mx-1 rounded bg-muted px-1 py-0.5 text-xs`}>card</code> variant
                    for hero placements. The waveform is procedurally derived from the source URL,
                    so every track gets its own visual fingerprint without pre-computing peaks
                    server-side.
                </p>
            </header>

            <section className={`flex flex-col gap-4`}>
                <div className={`flex items-baseline justify-between gap-4`}>
                    <h2 className={`text-lg font-semibold tracking-tight`}>
                        Card variant
                    </h2>
                    <div className={`flex items-center gap-1`}>
                        {SAMPLES.map((sample) => (
                            <Button
                                key={sample.id}
                                size={`sm`}
                                variant={activeId === sample.id ? `default` : `outline`}
                                onClick={() => setActiveId(sample.id)}
                            >
                                {sample.title}
                            </Button>
                        ))}
                    </div>
                </div>
                <AudioPlayer
                    src={active.src}
                    title={active.title}
                    subtitle={active.subtitle}
                    artwork={active.artwork}
                    variant={`card`}
                />
            </section>

            <section className={`flex flex-col gap-4`}>
                <h2 className={`text-lg font-semibold tracking-tight`}>
                    Bar variant
                </h2>
                <p className={`max-w-prose text-sm text-muted-foreground`}>
                    The bar is intentionally narrow — it's meant to live inside a list row,
                    a comment, or a table cell, and to disappear when there's nothing to play.
                </p>
                <AudioPlayer src={SAMPLES[0]!.src} />
                <AudioPlayer src={SAMPLES[1]!.src} />
            </section>

            <section className={`flex flex-col gap-4`}>
                <h2 className={`text-lg font-semibold tracking-tight`}>
                    Provided peaks
                </h2>
                <p className={`max-w-prose text-sm text-muted-foreground`}>
                    Pass an array of values in <code className={`rounded bg-muted px-1 py-0.5 text-xs`}>[0, 1]</code> via
                    <code className={`mx-1 rounded bg-muted px-1 py-0.5 text-xs`}>peaks</code> when
                    you have a pre-computed waveform (e.g. from server-side analysis).
                    Anything from 32 to 512 entries reads well at common widths.
                </p>
                <AudioPlayer
                    src={SAMPLES[0]!.src}
                    peaks={Array.from({ length: 96 }, (_, i) =>
                        0.3 + 0.6 * Math.abs(Math.sin(i / 6) * Math.cos(i / 14))
                    )}
                />
            </section>

            <section className={`flex flex-col gap-4`}>
                <h2 className={`text-lg font-semibold tracking-tight`}>
                    Keyboard
                </h2>
                <ul className={`grid grid-cols-2 gap-2 text-sm`}>
                    <li>
                        <kbd className={`rounded border bg-muted px-1.5 py-0.5 text-xs`}>Space</kbd>
                        <span className={`ml-2 text-muted-foreground`}>Play / pause</span>
                    </li>
                    <li>
                        <kbd className={`rounded border bg-muted px-1.5 py-0.5 text-xs`}>← / →</kbd>
                        <span className={`ml-2 text-muted-foreground`}>Skip ±5s</span>
                    </li>
                    <li>
                        <kbd className={`rounded border bg-muted px-1.5 py-0.5 text-xs`}>↑ / ↓</kbd>
                        <span className={`ml-2 text-muted-foreground`}>Volume ±10%</span>
                    </li>
                    <li>
                        <kbd className={`rounded border bg-muted px-1.5 py-0.5 text-xs`}>M</kbd>
                        <span className={`ml-2 text-muted-foreground`}>Mute</span>
                    </li>
                </ul>
            </section>
        </div>
    );
};

export default AudioPlayerDemoPage;
