import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const commandPaletteExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const commandPaletteExampleById = (id: string): RegisteredExample => {
    const found = commandPaletteExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No commandPalette example registered with id "${id}"`);
    return found;
};
