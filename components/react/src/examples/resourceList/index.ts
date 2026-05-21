import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const resourceListExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const resourceListExampleById = (id: string): RegisteredExample => {
    const found = resourceListExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No resourceList example registered with id "${id}"`);
    return found;
};
