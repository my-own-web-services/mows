import defaultExample from "./Default";
import defaultSource from "./Default.tsx?raw";
import fallback from "./Fallback";
import fallbackSource from "./Fallback.tsx?raw";
import sizes from "./Sizes";
import sizesSource from "./Sizes.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const fileIconExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultExample },
    { id: `sizes`, source: sizesSource, ...sizes },
    { id: `fallback`, source: fallbackSource, ...fallback }
];

export const fileIconExampleById = (id: string): RegisteredExample => {
    const found = fileIconExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No fileIcon example registered with id "${id}"`);
    return found;
};
