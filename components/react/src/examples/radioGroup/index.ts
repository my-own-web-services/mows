import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabledOption from "./DisabledOption";
import disabledOptionSource from "./DisabledOption.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const radioGroupExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabledOption`, source: disabledOptionSource, ...disabledOption }
];

export const radioGroupExampleById = (id: string): RegisteredExample => {
    const found = radioGroupExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No radioGroup example registered with id "${id}"`);
    return found;
};
