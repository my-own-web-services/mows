import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import indeterminate from "./Indeterminate";
import indeterminateSource from "./Indeterminate.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const checkboxExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `indeterminate`, source: indeterminateSource, ...indeterminate },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const checkboxExampleById = (id: string): RegisteredExample => {
    const found = checkboxExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No checkbox example registered with id "${id}"`);
    return found;
};
