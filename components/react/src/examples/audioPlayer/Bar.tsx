import AudioPlayer from "../../../lib/components/files/audioPlayer/AudioPlayer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ variant: `bar` });
    return (
        <div className={`w-full max-w-2xl`}>
            <AudioPlayer src={`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.audioPlayer.bar,
    Example
};

export default module;
