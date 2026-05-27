import { useState } from "react";
import { Timeline, type TimelineEvent } from "../../../lib/components/input/timeline/Timeline";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Simulated 90-second video clip. Timestamps are expressed as offsets from
// an arbitrary epoch so the math stays readable.
const ORIGIN = 0;
const DURATION_MS = 90 * 1_000;

const chapters: TimelineEvent[] = [
    { id: `intro`, timestamp: ORIGIN + 0, endTimestamp: ORIGIN + 12_000, title: `Intro`, status: `info` },
    {
        id: `interview`,
        timestamp: ORIGIN + 12_000,
        endTimestamp: ORIGIN + 55_000,
        title: `Interview`,
        status: `default`
    },
    {
        id: `b-roll`,
        timestamp: ORIGIN + 55_000,
        endTimestamp: ORIGIN + 80_000,
        title: `B-roll`,
        status: `success`
    },
    {
        id: `outro`,
        timestamp: ORIGIN + 80_000,
        endTimestamp: ORIGIN + 90_000,
        title: `Outro`,
        status: `warning`
    }
];

const formatMs = (ms: number) => {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, `0`)}`;
};

const Example = () => {
    const [time, setTime] = useState<number>(ORIGIN + 18_000);

    useExampleState({
        currentTime: formatMs(time - ORIGIN),
        clipDuration: `${DURATION_MS / 1000}s`
    });

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`text-sm tabular-nums text-muted-foreground`}>
                Playhead: <span className={`font-medium text-foreground`}>{formatMs(time - ORIGIN)}</span>
            </div>
            <Timeline
                from={ORIGIN}
                to={ORIGIN + DURATION_MS}
                events={chapters}
                currentTime={time}
                onCurrentTimeChange={setTime}
                minViewRangeMs={500}
                formatTickLabel={(d) => formatMs(d.getTime() - ORIGIN)}
                title={`Clip — drag the track to scrub`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timeline.videoScrubbing,
    Example
};

export default module;
