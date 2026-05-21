import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import hideIcon from "./HideIcon";
import hideIconSource from "./HideIcon.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const searchInputExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `hideIcon`, source: hideIconSource, ...hideIcon }
];

export const searchInputExampleById = (id: string): RegisteredExample => {
    const found = searchInputExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No searchInput example registered with id "${id}"`);
    return found;
};
