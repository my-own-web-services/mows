import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const switchExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const switchExampleById = (id: string): RegisteredExample => {
    const found = switchExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No switch example registered with id "${id}"`);
    return found;
};
