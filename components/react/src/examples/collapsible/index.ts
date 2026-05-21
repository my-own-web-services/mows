import controlled from "./Controlled";
import controlledSource from "./Controlled.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import nested from "./Nested";
import nestedSource from "./Nested.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const collapsibleExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `controlled`, source: controlledSource, ...controlled },
    { id: `nested`, source: nestedSource, ...nested }
];

export const collapsibleExampleById = (id: string): RegisteredExample => {
    const found = collapsibleExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No collapsible example registered with id "${id}"`);
    return found;
};
