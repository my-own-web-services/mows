import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const loggingConfigExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const loggingConfigExampleById = (id: string): RegisteredExample => {
    const found = loggingConfigExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No loggingConfig example registered with id "${id}"`);
    return found;
};
