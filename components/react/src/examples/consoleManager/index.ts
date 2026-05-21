import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const consoleManagerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const consoleManagerExampleById = (id: string): RegisteredExample => {
    const found = consoleManagerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No consoleManager example registered with id "${id}"`);
    return found;
};
