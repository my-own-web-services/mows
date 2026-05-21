import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const actionDisplayExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const actionDisplayExampleById = (id: string): RegisteredExample => {
    const found = actionDisplayExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No actionDisplay example registered with id "${id}"`);
    return found;
};
