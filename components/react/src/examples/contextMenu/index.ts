import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const contextMenuExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const contextMenuExampleById = (id: string): RegisteredExample => {
    const found = contextMenuExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No contextMenu example registered with id "${id}"`);
    return found;
};
