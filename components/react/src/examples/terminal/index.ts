import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const terminalExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const terminalExampleById = (id: string): RegisteredExample => {
    const found = terminalExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No terminal example registered with id "${id}"`);
    return found;
};
