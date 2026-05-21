import { useMemo, useState } from "react";
import Image360Viewer, {
    type Image360ViewerMarker
} from "../../../lib/components/files/fileViewer/formats/image360Viewer/Image360Viewer";
import samplePanoramaUrl from "../../assets/samples/panorama-4000.jpg";
import landscapeUrl from "../../assets/samples/landscape-2000.webp";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// Each "scene" is one panorama plus a set of hotspots that, when
// clicked, navigate to another scene via the `data.target` payload. The
// click handler reads `data.target` off the clicked marker and swaps
// the active scene. In a real virtual tour this same wiring would route
// to a URL, open an info panel, fire an analytics event, etc.
interface Scene {
    readonly id: string;
    readonly title: string;
    readonly src: string;
    readonly markers: ReadonlyArray<Image360ViewerMarker>;
}

const SCENES: ReadonlyArray<Scene> = [
    {
        id: `plaza`,
        title: `Plaza`,
        src: samplePanoramaUrl,
        markers: [
            {
                id: `to-overlook`,
                position: { yaw: `45deg`, pitch: `-2deg` },
                html: `<div class="psv-marker-pin"><span>Overlook ›</span></div>`,
                size: { width: 110, height: 32 },
                anchor: `bottom center`,
                tooltip: { content: `Walk up to the overlook` },
                data: { target: `overlook` }
            },
            {
                id: `info-fountain`,
                position: { yaw: `180deg`, pitch: `-5deg` },
                html: `<div class="psv-marker-dot" aria-hidden></div>`,
                size: { width: 18, height: 18 },
                anchor: `center center`,
                tooltip: { content: `The Fountain (info hotspot)` },
                data: { target: null }
            }
        ]
    },
    {
        id: `overlook`,
        title: `Overlook`,
        src: landscapeUrl,
        markers: [
            {
                id: `to-plaza`,
                position: { yaw: `225deg`, pitch: `-2deg` },
                html: `<div class="psv-marker-pin"><span>‹ Plaza</span></div>`,
                size: { width: 110, height: 32 },
                anchor: `bottom center`,
                tooltip: { content: `Back to the plaza` },
                data: { target: `plaza` }
            }
        ]
    }
];

const Example = () => {
    const [sceneId, setSceneId] = useState<string>(SCENES[0].id);
    useExampleState({ sceneId });
    const scene = useMemo(
        () => SCENES.find((s) => s.id === sceneId) ?? SCENES[0],
        [sceneId]
    );

    const onMarkerClick = (marker: Image360ViewerMarker): void => {
        const data = (marker.data ?? {}) as { target?: string | null };
        if (data.target) setSceneId(data.target);
    };

    return (
        <div className={`flex flex-col gap-3`}>
            {/*
             * Marker styling is purely CSS — the markers-plugin renders our
             * `html` strings into the SVG overlay, so a couple of
             * <style> rules let us theme the pins / dots without leaking
             * styles outside the example.
             */}
            <style>{`
                .psv-marker-pin {
                    background: rgba(15, 23, 42, 0.85);
                    color: #fff;
                    font: 600 12px / 1 ui-sans-serif, system-ui, sans-serif;
                    padding: 8px 12px;
                    border-radius: 9999px;
                    box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 6px 16px rgba(0,0,0,0.35);
                    white-space: nowrap;
                }
                .psv-marker-dot {
                    width: 18px;
                    height: 18px;
                    border-radius: 9999px;
                    background: #3dc9b0;
                    box-shadow: 0 0 0 4px rgba(61, 201, 176, 0.25), 0 4px 12px rgba(0,0,0,0.35);
                }
            `}</style>
            <div className={`flex items-baseline justify-between text-sm`}>
                <span className={`text-muted-foreground`}>Scene:</span>
                <span className={`font-medium`}>{scene.title}</span>
            </div>
            <div
                className={`relative aspect-video w-full max-w-2xl overflow-hidden rounded-md border bg-background`}
            >
                <Image360Viewer
                    src={scene.src}
                    markers={scene.markers}
                    onMarkerClick={onMarkerClick}
                />
            </div>
            <p className={`text-muted-foreground text-xs`}>
                Click the labelled pin to navigate between scenes. The teal dot is an info
                hotspot — its tooltip shows on hover but the click is a no-op.
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.image360Viewer.virtualTour,
    Example
};

export default module;
