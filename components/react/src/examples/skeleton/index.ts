import card from "./Card";
import cardSource from "./Card.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const skeletonExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `card`, source: cardSource, ...card }
];

export const skeletonExampleById = (id: string): RegisteredExample => {
    const found = skeletonExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No skeleton example registered with id "${id}"`);
    return found;
};
