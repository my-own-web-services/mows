import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import htmlFor from "./HtmlFor";
import htmlForSource from "./HtmlFor.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const labelExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `htmlFor`, source: htmlForSource, ...htmlFor }
];

export const labelExampleById = (id: string): RegisteredExample => {
    const found = labelExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No label example registered with id "${id}"`);
    return found;
};
