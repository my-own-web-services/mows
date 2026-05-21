import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const keyboardShortcutEditorExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const keyboardShortcutEditorExampleById = (id: string): RegisteredExample => {
    const found = keyboardShortcutEditorExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No keyboardShortcutEditor example registered with id "${id}"`);
    return found;
};
