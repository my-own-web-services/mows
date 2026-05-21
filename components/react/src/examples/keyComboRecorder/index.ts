import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const keyComboRecorderExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const keyComboRecorderExampleById = (id: string): RegisteredExample => {
    const found = keyComboRecorderExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No keyComboRecorder example registered with id "${id}"`);
    return found;
};
