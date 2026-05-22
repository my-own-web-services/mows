import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const locationPickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const locationPickerExampleById = (id: string): RegisteredExample => {
    const found = locationPickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No locationPicker example registered with id "${id}"`);
    return found;
};
