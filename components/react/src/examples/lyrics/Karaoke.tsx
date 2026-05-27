import { useState } from "react";
import Lyrics from "../../../lib/components/files/lyrics/Lyrics";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE_LRC_ENHANCED = `[ti:Travel Light (Karaoke)]
[ar:MOWS Demo Choir]
[00:00.00]<00:00.00>Hold <00:00.45>steady, <00:00.90>breathe <00:01.40>slow,
[00:02.00]<00:02.00>the <00:02.20>river <00:02.70>keeps <00:03.20>going
[00:04.00]<00:04.00>Hold <00:04.40>steady, <00:04.90>breathe <00:05.40>slow,
[00:06.00]<00:06.00>the <00:06.20>river <00:06.70>keeps <00:07.20>going`;

const DURATION = 9;

const Example = () => {
    const [time, setTime] = useState<number>(0.6);
    useExampleState({ currentTime: time });

    return (
        <div className={`flex w-full max-w-lg flex-col gap-4`}>
            <Lyrics
                source={SAMPLE_LRC_ENHANCED}
                currentTime={time}
                onSeek={(s) => setTime(s)}
            />
            <Slider
                aria-label={`Scrub`}
                value={[time]}
                min={0}
                max={DURATION}
                step={0.05}
                onValueChange={(v) => setTime(v[0])}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.lyrics.karaoke,
    Example
};

export default module;
