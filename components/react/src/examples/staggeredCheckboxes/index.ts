import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import searchableModule from "./Searchable";
import searchableSource from "./Searchable.tsx?raw";
import selfOnlyModule from "./SelfOnly";
import selfOnlySource from "./SelfOnly.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const staggeredCheckboxesExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `searchable`, source: searchableSource, ...searchableModule },
    { id: `selfOnly`, source: selfOnlySource, ...selfOnlyModule }
];

export const staggeredCheckboxesExampleById = (id: string): RegisteredExample => {
    const found = staggeredCheckboxesExamples.find((example) => example.id === id);
    if (!found)
        throw new Error(`No staggeredCheckboxes example registered with id "${id}"`);
    return found;
};
