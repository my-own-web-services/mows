import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import switchImages from "./SwitchImages";
import switchImagesSource from "./SwitchImages.tsx?raw";
import compassOverlay from "./CompassOverlay";
import compassOverlaySource from "./CompassOverlay.tsx?raw";
import virtualTour from "./VirtualTour";
import virtualTourSource from "./VirtualTour.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const image360ViewerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `switchImages`, source: switchImagesSource, ...switchImages },
    { id: `compassOverlay`, source: compassOverlaySource, ...compassOverlay },
    { id: `virtualTour`, source: virtualTourSource, ...virtualTour }
];

export const image360ViewerExampleById = (id: string): RegisteredExample => {
    const found = image360ViewerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No image360Viewer example registered with id "${id}"`);
    return found;
};
