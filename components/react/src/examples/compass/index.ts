import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import markers from "./Markers";
import markersSource from "./Markers.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const compassExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `markers`, source: markersSource, ...markers }
];

export const compassExampleById = (id: string): RegisteredExample => {
    const found = compassExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No compass example registered with id "${id}"`);
    return found;
};
