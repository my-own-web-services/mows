import VideoViewer from "../../../lib/components/files/fileViewer/formats/videoViewer/VideoViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Akamai's public Big Buck Bunny DASH stream — multi-bitrate so the quality
// menu lights up.
const SRC = `https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`;
const MIME = `application/dash+xml`;

const Example = () => {
    useExampleState({ src: SRC, mimeType: MIME });
    return (
        <div className={`aspect-video w-full max-w-3xl overflow-hidden rounded-md border`}>
            <VideoViewer src={SRC} mimeType={MIME} name={`Big Buck Bunny (DASH)`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.videoViewer.dash,
    Example
};

export default module;
