import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import modifierVariants from "./ModifierVariants";
import modifierVariantsSource from "./ModifierVariants.tsx?raw";
import submenus from "./Submenus";
import submenusSource from "./Submenus.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const globalContextMenuExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `submenus`, source: submenusSource, ...submenus },
    { id: `modifierVariants`, source: modifierVariantsSource, ...modifierVariants }
];

export const globalContextMenuExampleById = (id: string): RegisteredExample => {
    const found = globalContextMenuExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No globalContextMenu example registered with id "${id}"`);
    return found;
};
