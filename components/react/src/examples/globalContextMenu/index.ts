import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const globalContextMenuExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const globalContextMenuExampleById = (id: string): RegisteredExample => {
    const found = globalContextMenuExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No globalContextMenu example registered with id "${id}"`);
    return found;
};
