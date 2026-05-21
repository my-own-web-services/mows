import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import readOnly from "./ReadOnly";
import readOnlySource from "./ReadOnly.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const machineMonitorExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `readOnly`, source: readOnlySource, ...readOnly }
];

export const machineMonitorExampleById = (id: string): RegisteredExample => {
    const found = machineMonitorExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No machineMonitor example registered with id "${id}"`);
    return found;
};
