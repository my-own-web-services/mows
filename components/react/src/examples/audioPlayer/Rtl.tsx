import AudioPlayer from "../../../lib/components/files/audioPlayer/AudioPlayer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ direction: `rtl` });
    return (
        <div dir={`rtl`} className={`flex w-full max-w-2xl flex-col`}>
            <AudioPlayer
                variant={`card`}
                title={`صباح الخير`}
                subtitle={`تسجيل ميداني · محيط`}
                src={`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.audioPlayer.rtl,
    Example
};

export default module;
