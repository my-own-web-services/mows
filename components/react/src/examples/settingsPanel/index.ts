import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const settingsPanelExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const settingsPanelExampleById = (id: string): RegisteredExample => {
    const found = settingsPanelExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No settingsPanel example registered with id "${id}"`);
    return found;
};
