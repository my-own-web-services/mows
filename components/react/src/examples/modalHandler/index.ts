import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const modalHandlerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const modalHandlerExampleById = (id: string): RegisteredExample => {
    const found = modalHandlerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No modalHandler example registered with id "${id}"`);
    return found;
};
