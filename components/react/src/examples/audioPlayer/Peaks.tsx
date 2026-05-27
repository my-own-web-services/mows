import AudioPlayer from "../../../lib/components/files/audioPlayer/AudioPlayer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// A pre-computed waveform from server-side analysis would look like this —
// here it's synthesised from a sin × cos product so the shape is deliberate
// instead of procedural. 96 samples reads well at the bar's typical width.
const PEAKS = Array.from({ length: 96 }, (_, i) =>
    0.3 + 0.6 * Math.abs(Math.sin(i / 6) * Math.cos(i / 14))
);

const Example = () => {
    useExampleState({ peakCount: PEAKS.length });
    return (
        <div className={`flex w-full max-w-2xl flex-col`}>
            <AudioPlayer
                src={`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`}
                peaks={PEAKS}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.audioPlayer.peaks,
    Example
};

export default module;
