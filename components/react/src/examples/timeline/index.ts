import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import videoScrubbing from "./VideoScrubbing";
import videoScrubbingSource from "./VideoScrubbing.tsx?raw";
import rtl from "./RTL";
import rtlSource from "./RTL.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const timelineExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `videoScrubbing`, source: videoScrubbingSource, ...videoScrubbing },
    { id: `rtl`, source: rtlSource, ...rtl }
];

export const timelineExampleById = (id: string): RegisteredExample => {
    const found = timelineExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No timeline example registered with id "${id}"`);
    return found;
};
