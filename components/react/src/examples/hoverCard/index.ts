import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const hoverCardExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const hoverCardExampleById = (id: string): RegisteredExample => {
    const found = hoverCardExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No hoverCard example registered with id "${id}"`);
    return found;
};
