import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabledOption from "./DisabledOption";
import disabledOptionSource from "./DisabledOption.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const selectExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabledOption`, source: disabledOptionSource, ...disabledOption }
];

export const selectExampleById = (id: string): RegisteredExample => {
    const found = selectExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No select example registered with id "${id}"`);
    return found;
};
