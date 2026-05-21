import { useRef, useState } from "react";
import VideoViewer from "../../../lib/components/files/fileViewer/formats/videoViewer/VideoViewer";
import { type Chapter } from "../../../lib/components/files/fileViewer/formats/videoViewer/types";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Sintel trailer, with chapters covering the four narrative beats. Times
// are eyeballed from the public Sintel cut; they exist to demonstrate the
// chapter UX, not as an authoritative cut.
const SRC = `https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/v-0480p-1000k-libx264.mp4`;
const MIME = `video/mp4`;
const CHAPTERS: ReadonlyArray<Chapter> = [
    { id: `intro`, title: `Opening`, startTime: 0 },
    { id: `quest`, title: `The quest`, startTime: 120 },
    { id: `dragon`, title: `Dragon`, startTime: 360 },
    { id: `finale`, title: `Finale`, startTime: 720 }
];

const formatMmSs = (s: number): string => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, `0`);
    return `${m}:${ss}`;
};

const Example = () => {
    // The VideoViewer is a class component, so we keep a ref to the
    // instance and call its public `seekTo` from the chapter buttons.
    const viewerRef = useRef<VideoViewer | null>(null);
    const [activeId, setActiveId] = useState(CHAPTERS[0].id);
    useExampleState({ chapters: CHAPTERS.length, activeId });
    const jumpTo = (chapter: Chapter): void => {
        viewerRef.current?.seekTo(chapter.startTime);
        setActiveId(chapter.id);
    };
    return (
        <div className={`flex w-full max-w-3xl flex-col gap-3`}>
            <div className={`aspect-video w-full overflow-hidden rounded-md border`}>
                <VideoViewer
                    ref={viewerRef}
                    src={SRC}
                    mimeType={MIME}
                    name={`Sintel`}
                    chapters={CHAPTERS}
                />
            </div>
            <div
                role={`group`}
                aria-label={`Jump to chapter`}
                className={`flex flex-wrap gap-2`}
            >
                {CHAPTERS.map((c) => (
                    <Button
                        key={c.id}
                        type={`button`}
                        size={`sm`}
                        variant={c.id === activeId ? `default` : `outline`}
                        className={`gap-2`}
                        onClick={() => jumpTo(c)}
                    >
                        <span>{c.title}</span>
                        <span className={`text-xs text-muted-foreground tabular-nums`}>
                            {formatMmSs(c.startTime)}
                        </span>
                    </Button>
                ))}
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.videoViewer.chapters,
    Example
};

export default module;
