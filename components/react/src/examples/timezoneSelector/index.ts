import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const timezoneSelectorExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const timezoneSelectorExampleById = (id: string): RegisteredExample => {
    const found = timezoneSelectorExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No timezoneSelector example registered with id "${id}"`);
    return found;
};
