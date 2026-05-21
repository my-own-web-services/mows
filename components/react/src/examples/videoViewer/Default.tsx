import VideoViewer from "../../../lib/components/files/fileViewer/formats/videoViewer/VideoViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Sintel trailer, single-bitrate H.264 MP4. Hosted by the Shaka project on
// Google Cloud Storage with `Access-Control-Allow-Origin: *` so Shaka's MSE
// path can read the byte ranges; needed because Chrome's ORB otherwise
// blocks opaque media responses from CORS-less origins.
const SRC = `https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/v-0480p-1000k-libx264.mp4`;
const MIME = `video/mp4`;

const Example = () => {
    useExampleState({ src: SRC, mimeType: MIME });
    return (
        <div className={`aspect-video w-full max-w-3xl overflow-hidden rounded-md border`}>
            <VideoViewer src={SRC} mimeType={MIME} name={`Sintel`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.videoViewer.default,
    Example
};

export default module;
