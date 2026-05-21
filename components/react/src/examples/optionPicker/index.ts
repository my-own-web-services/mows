import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const optionPickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const optionPickerExampleById = (id: string): RegisteredExample => {
    const found = optionPickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No optionPicker example registered with id "${id}"`);
    return found;
};
