import Image360Viewer from "../../../lib/components/files/fileViewer/formats/image360Viewer/Image360Viewer";
import samplePanoramaUrl from "../../assets/samples/panorama-4000.jpg";
import type { ExampleModule } from "../harness/types";

const Example = () => (
    <div className={`aspect-video w-full max-w-2xl rounded-md border bg-background`}>
        <Image360Viewer src={samplePanoramaUrl} />
    </div>
);

const module: ExampleModule = {
    strings: (t) => t.examples.image360Viewer.default,
    Example
};

export default module;
