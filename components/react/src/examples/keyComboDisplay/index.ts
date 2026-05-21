import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const keyComboDisplayExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const keyComboDisplayExampleById = (id: string): RegisteredExample => {
    const found = keyComboDisplayExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No keyComboDisplay example registered with id "${id}"`);
    return found;
};
