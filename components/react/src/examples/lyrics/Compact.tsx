import { useState } from "react";
import Lyrics from "../../../lib/components/files/lyrics/Lyrics";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE_LRC = `[ti:Travel Light]
[ar:MOWS Demo Choir]
[00:00.00]We packed the morning into a single bag
[00:04.20]Counted every footstep across the bridge
[00:08.80]Roads we'd never seen sang us their name
[00:13.30]A wind picked up and held us in the light
[00:18.00]Hold steady, breathe slow, the river keeps going
[00:22.40]We'll find a quiet place by morning
[00:27.10]Where the world remembers our name`;

const DURATION = 32;

const Example = () => {
    const [time, setTime] = useState<number>(10);
    useExampleState({ variant: `compact`, currentTime: time });

    return (
        <div className={`flex w-full max-w-md flex-col gap-4`}>
            <Lyrics
                variant={`compact`}
                source={SAMPLE_LRC}
                currentTime={time}
                onSeek={(s) => setTime(s)}
            />
            <Slider
                aria-label={`Scrub`}
                value={[time]}
                min={0}
                max={DURATION}
                step={0.1}
                onValueChange={(v) => setTime(v[0])}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.lyrics.compact,
    Example
};

export default module;
