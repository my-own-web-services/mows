import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import headerOnly from "./HeaderOnly";
import headerOnlySource from "./HeaderOnly.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const cardExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `headerOnly`, source: headerOnlySource, ...headerOnly }
];

export const cardExampleById = (id: string): RegisteredExample => {
    const found = cardExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No card example registered with id "${id}"`);
    return found;
};
