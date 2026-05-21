import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const dateTimeDisplayExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const dateTimeDisplayExampleById = (id: string): RegisteredExample => {
    const found = dateTimeDisplayExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No dateTimeDisplay example registered with id "${id}"`);
    return found;
};
