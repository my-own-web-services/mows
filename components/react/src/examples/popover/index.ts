import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import form from "./Form";
import formSource from "./Form.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const popoverExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `form`, source: formSource, ...form }
];

export const popoverExampleById = (id: string): RegisteredExample => {
    const found = popoverExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No popover example registered with id "${id}"`);
    return found;
};
