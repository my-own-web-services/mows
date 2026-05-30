import controlledModule from "./Controlled";
import controlledSource from "./Controlled.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabledModule from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import stackModule from "./Stack";
import stackSource from "./Stack.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const expandableSectionExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `stack`, source: stackSource, ...stackModule },
    { id: `controlled`, source: controlledSource, ...controlledModule },
    { id: `disabled`, source: disabledSource, ...disabledModule }
];

export const expandableSectionExampleById = (id: string): RegisteredExample => {
    const found = expandableSectionExamples.find((example) => example.id === id);
    if (!found)
        throw new Error(`No expandableSection example registered with id "${id}"`);
    return found;
};
