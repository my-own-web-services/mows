import { useState } from "react";
import Image360Viewer from "../../../lib/components/files/fileViewer/formats/image360Viewer/Image360Viewer";
import Compass from "../../../lib/components/navigation/compass/Compass";
import samplePanoramaUrl from "../../assets/samples/panorama-4000.jpg";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// HUD-style: render the Compass absolutely on top of the viewer (instead
// of below it) so the bearing readout stays visible while the user looks
// around. Pinned to the top, narrow + muted so it reads as a subtle HUD
// element rather than a primary control. The Compass component is purely
// cosmetic, so we let pointer events fall through to the sphere underneath.
const Example = () => {
    const [heading, setHeading] = useState(0);
    useExampleState({ heading });

    return (
        <div
            className={`relative aspect-video w-full max-w-2xl overflow-hidden rounded-md border bg-background`}
        >
            <Image360Viewer src={samplePanoramaUrl} onHeadingChange={setHeading} />
            <div
                className={`pointer-events-none absolute top-3 left-1/2 w-72 -translate-x-1/2 opacity-80`}
                aria-hidden={false}
            >
                <Compass heading={heading} compact />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.image360Viewer.compassOverlay,
    Example
};

export default module;
