import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import loading from "./Loading";
import loadingSource from "./Loading.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const avatarExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `loading`, source: loadingSource, ...loading }
];

export const avatarExampleById = (id: string): RegisteredExample => {
    const found = avatarExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No avatar example registered with id "${id}"`);
    return found;
};
