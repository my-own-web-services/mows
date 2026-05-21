import fixedModule from "./Fixed";
import fixedSource from "./Fixed.tsx?raw";
import inline from "./Inline";
import inlineSource from "./Inline.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const primaryMenuExamples: ReadonlyArray<RegisteredExample> = [
    { id: `inline`, source: inlineSource, ...inline },
    { id: `fixed`, source: fixedSource, ...fixedModule }
];

export const primaryMenuExampleById = (id: string): RegisteredExample => {
    const found = primaryMenuExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No primaryMenu example registered with id "${id}"`);
    return found;
};
