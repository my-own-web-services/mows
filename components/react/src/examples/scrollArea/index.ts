import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import horizontal from "./Horizontal";
import horizontalSource from "./Horizontal.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const scrollAreaExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `horizontal`, source: horizontalSource, ...horizontal }
];

export const scrollAreaExampleById = (id: string): RegisteredExample => {
    const found = scrollAreaExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No scrollArea example registered with id "${id}"`);
    return found;
};
