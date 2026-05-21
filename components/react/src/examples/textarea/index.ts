import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const textareaExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const textareaExampleById = (id: string): RegisteredExample => {
    const found = textareaExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No textarea example registered with id "${id}"`);
    return found;
};
