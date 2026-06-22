import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import emptyModule from "./Empty";
import emptySource from "./Empty.tsx?raw";
import filteredModule from "./Filtered";
import filteredSource from "./Filtered.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const historyPanelExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `filtered`, source: filteredSource, ...filteredModule },
    { id: `empty`, source: emptySource, ...emptyModule }
];

export const historyPanelExampleById = (id: string): RegisteredExample => {
    const found = historyPanelExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No historyPanel example registered with id "${id}"`);
    return found;
};
