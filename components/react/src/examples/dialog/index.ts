import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import hideClose from "./HideCloseButton";
import hideCloseSource from "./HideCloseButton.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const dialogExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `hideClose`, source: hideCloseSource, ...hideClose }
];

export const dialogExampleById = (id: string): RegisteredExample => {
    const found = dialogExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No dialog example registered with id "${id}"`);
    return found;
};
