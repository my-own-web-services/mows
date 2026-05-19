import defaultExample from "./Default";
import defaultSource from "./Default.tsx?raw";
import nestedExample from "./Nested";
import nestedSource from "./Nested.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const pageIndexExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultExample },
    { id: `nested`, source: nestedSource, ...nestedExample }
];

export const pageIndexExampleById = (id: string): RegisteredExample => {
    const found = pageIndexExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No pageIndex example registered with id "${id}"`);
    return found;
};
