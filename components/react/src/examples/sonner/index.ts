import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const sonnerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const sonnerExampleById = (id: string): RegisteredExample => {
    const found = sonnerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No sonner example registered with id "${id}"`);
    return found;
};
