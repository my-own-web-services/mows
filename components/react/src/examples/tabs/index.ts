import controlled from "./Controlled";
import controlledSource from "./Controlled.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const tabsExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disabled`, source: disabledSource, ...disabled },
    { id: `controlled`, source: controlledSource, ...controlled }
];

export const tabsExampleById = (id: string): RegisteredExample => {
    const found = tabsExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No tabs example registered with id "${id}"`);
    return found;
};
