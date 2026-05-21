import { useState } from "react";
import Image360Viewer from "../../../lib/components/files/fileViewer/formats/image360Viewer/Image360Viewer";
import { Button } from "../../../lib/components/ui/button";
import panoramaUrl from "../../assets/samples/panorama-4000.jpg";
import landscapeUrl from "../../assets/samples/landscape-2000.webp";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Two-source switcher: clicking a button updates `src`, which
// `componentDidUpdate` picks up and feeds into `viewer.setPanorama()`.
// The viewer reuses its existing GL context — no remount, no skeleton.
const IMAGES = [
    { id: `panorama`, label: `Panorama`, src: panoramaUrl },
    { id: `landscape`, label: `Landscape`, src: landscapeUrl }
] as const;

type ImageId = (typeof IMAGES)[number][`id`];

const Example = () => {
    const [activeId, setActiveId] = useState<ImageId>(IMAGES[0].id);
    useExampleState({ activeId });
    const active = IMAGES.find((i) => i.id === activeId) ?? IMAGES[0];

    return (
        <div className={`flex w-full max-w-2xl flex-col gap-3`}>
            <div
                className={`aspect-video w-full overflow-hidden rounded-md border bg-background`}
            >
                <Image360Viewer src={active.src} />
            </div>
            <div className={`flex gap-2`}>
                {IMAGES.map((image) => (
                    <Button
                        key={image.id}
                        type={`button`}
                        variant={image.id === activeId ? `default` : `outline`}
                        onClick={() => setActiveId(image.id)}
                    >
                        {image.label}
                    </Button>
                ))}
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.image360Viewer.switchImages,
    Example
};

export default module;
