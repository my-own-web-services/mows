import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import hideToolbar from "./HideToolbar";
import hideToolbarSource from "./HideToolbar.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const logViewExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `hideToolbar`, source: hideToolbarSource, ...hideToolbar }
];

export const logViewExampleById = (id: string): RegisteredExample => {
    const found = logViewExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No logView example registered with id "${id}"`);
    return found;
};
