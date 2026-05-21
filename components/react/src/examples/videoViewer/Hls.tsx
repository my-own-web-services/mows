import VideoViewer from "../../../lib/components/files/fileViewer/formats/videoViewer/VideoViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Mux's public test HLS stream — multiple renditions plus subtitles, so both
// the quality and captions menus light up.
const SRC = `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`;
const MIME = `application/vnd.apple.mpegurl`;

const Example = () => {
    useExampleState({ src: SRC, mimeType: MIME });
    return (
        <div className={`aspect-video w-full max-w-3xl overflow-hidden rounded-md border`}>
            <VideoViewer src={SRC} mimeType={MIME} name={`HLS sample`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.videoViewer.hls,
    Example
};

export default module;
