import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import variants from "./Variants";
import variantsSource from "./Variants.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const badgeExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `variants`, source: variantsSource, ...variants }
];

export const badgeExampleById = (id: string): RegisteredExample => {
    const found = badgeExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No badge example registered with id "${id}"`);
    return found;
};
