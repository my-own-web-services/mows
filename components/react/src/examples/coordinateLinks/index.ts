import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import withLabel from "./WithLabel";
import withLabelSource from "./WithLabel.tsx?raw";
import custom from "./Custom";
import customSource from "./Custom.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const coordinateLinksExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `withLabel`, source: withLabelSource, ...withLabel },
    { id: `custom`, source: customSource, ...custom }
];

export const coordinateLinksExampleById = (id: string): RegisteredExample => {
    const found = coordinateLinksExamples.find((example) => example.id === id);
    if (!found)
        throw new Error(`No coordinateLinks example registered with id "${id}"`);
    return found;
};
