import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import trailingAddon from "./TrailingAddon";
import trailingAddonSource from "./TrailingAddon.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const inputGroupExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `trailingAddon`, source: trailingAddonSource, ...trailingAddon }
];

export const inputGroupExampleById = (id: string): RegisteredExample => {
    const found = inputGroupExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No inputGroup example registered with id "${id}"`);
    return found;
};
