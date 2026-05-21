import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const fileViewerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const fileViewerExampleById = (id: string): RegisteredExample => {
    const found = fileViewerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No fileViewer example registered with id "${id}"`);
    return found;
};
