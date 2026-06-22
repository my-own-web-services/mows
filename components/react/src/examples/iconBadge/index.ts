import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import positions from "./Positions";
import positionsSource from "./Positions.tsx?raw";
import patterns from "./Patterns";
import patternsSource from "./Patterns.tsx?raw";
import filled from "./Filled";
import filledSource from "./Filled.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const iconBadgeExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `positions`, source: positionsSource, ...positions },
    { id: `patterns`, source: patternsSource, ...patterns },
    { id: `filled`, source: filledSource, ...filled }
];

export const iconBadgeExampleById = (id: string): RegisteredExample => {
    const found = iconBadgeExamples.find((example) => example.id === id);
    if (!found)
        throw new Error(`No iconBadge example registered with id "${id}"`);
    return found;
};
