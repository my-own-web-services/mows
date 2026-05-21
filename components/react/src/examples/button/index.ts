import asChild from "./AsChild";
import asChildSource from "./AsChild.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import sizes from "./Sizes";
import sizesSource from "./Sizes.tsx?raw";
import variants from "./Variants";
import variantsSource from "./Variants.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const buttonExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `variants`, source: variantsSource, ...variants },
    { id: `sizes`, source: sizesSource, ...sizes },
    { id: `asChild`, source: asChildSource, ...asChild }
];

export const buttonExampleById = (id: string): RegisteredExample => {
    const found = buttonExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No button example registered with id "${id}"`);
    return found;
};
