import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import disabledOption from "./DisabledOption";
import disabledOptionSource from "./DisabledOption.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const buttonSelectExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabled`, source: disabledSource, ...disabled },
    { id: `disabledOption`, source: disabledOptionSource, ...disabledOption }
];

export const buttonSelectExampleById = (id: string): RegisteredExample => {
    const found = buttonSelectExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No buttonSelect example registered with id "${id}"`);
    return found;
};
