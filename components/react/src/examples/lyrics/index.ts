import basicModule from "./Basic";
import basicSource from "./Basic.tsx?raw";
import compactModule from "./Compact";
import compactSource from "./Compact.tsx?raw";
import karaokeModule from "./Karaoke";
import karaokeSource from "./Karaoke.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import syncedModule from "./Synced";
import syncedSource from "./Synced.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const lyricsExamples: ReadonlyArray<RegisteredExample> = [
    { id: `basic`, source: basicSource, ...basicModule },
    { id: `compact`, source: compactSource, ...compactModule },
    { id: `karaoke`, source: karaokeSource, ...karaokeModule },
    { id: `synced`, source: syncedSource, ...syncedModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const lyricsExampleById = (id: string): RegisteredExample => {
    const found = lyricsExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No lyrics example registered with id "${id}"`);
    return found;
};
