import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import types from "./Types";
import typesSource from "./Types.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const inputExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `types`, source: typesSource, ...types },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const inputExampleById = (id: string): RegisteredExample => {
    const found = inputExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No input example registered with id "${id}"`);
    return found;
};
