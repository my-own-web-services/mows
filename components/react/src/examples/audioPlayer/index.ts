import barModule from "./Bar";
import barSource from "./Bar.tsx?raw";
import cardModule from "./Card";
import cardSource from "./Card.tsx?raw";
import minimalModule from "./Minimal";
import minimalSource from "./Minimal.tsx?raw";
import peaksModule from "./Peaks";
import peaksSource from "./Peaks.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const audioPlayerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `bar`, source: barSource, ...barModule },
    { id: `card`, source: cardSource, ...cardModule },
    { id: `minimal`, source: minimalSource, ...minimalModule },
    { id: `peaks`, source: peaksSource, ...peaksModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const audioPlayerExampleById = (id: string): RegisteredExample => {
    const found = audioPlayerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No audioPlayer example registered with id "${id}"`);
    return found;
};
