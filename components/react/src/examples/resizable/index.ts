import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import vertical from "./Vertical";
import verticalSource from "./Vertical.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const resizableExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `vertical`, source: verticalSource, ...vertical }
];

export const resizableExampleById = (id: string): RegisteredExample => {
    const found = resizableExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No resizable example registered with id "${id}"`);
    return found;
};
