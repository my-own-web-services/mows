import chapters from "./Chapters";
import chaptersSource from "./Chapters.tsx?raw";
import controls from "./Controls";
import controlsSource from "./Controls.tsx?raw";
import dash from "./Dash";
import dashSource from "./Dash.tsx?raw";
import defaultExample from "./Default";
import defaultSource from "./Default.tsx?raw";
import hls from "./Hls";
import hlsSource from "./Hls.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const videoViewerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultExample },
    { id: `dash`, source: dashSource, ...dash },
    { id: `hls`, source: hlsSource, ...hls },
    { id: `chapters`, source: chaptersSource, ...chapters },
    { id: `controls`, source: controlsSource, ...controls }
];

export const videoViewerExampleById = (id: string): RegisteredExample => {
    const found = videoViewerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No videoViewer example registered with id "${id}"`);
    return found;
};
