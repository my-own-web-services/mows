import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import short from "./Short";
import shortSource from "./Short.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const expandableCodeExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `short`, source: shortSource, ...short }
];

export const expandableCodeExampleById = (id: string): RegisteredExample => {
    const found = expandableCodeExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No expandableCode example registered with id "${id}"`);
    return found;
};
