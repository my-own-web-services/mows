import AudioPlayer from "../../../lib/components/files/audioPlayer/AudioPlayer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ variant: `card` });
    return (
        <div className={`flex w-full max-w-2xl flex-col`}>
            <AudioPlayer
                variant={`card`}
                title={`Forest, Morning`}
                subtitle={`Field recording · ambient`}
                artwork={`https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=320&q=80`}
                src={`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.audioPlayer.card,
    Example
};

export default module;
