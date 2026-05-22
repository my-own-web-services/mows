import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const mapExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const mapExampleById = (id: string): RegisteredExample => {
    const found = mapExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No map example registered with id "${id}"`);
    return found;
};
