import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const dropdownMenuExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const dropdownMenuExampleById = (id: string): RegisteredExample => {
    const found = dropdownMenuExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No dropdownMenu example registered with id "${id}"`);
    return found;
};
