import animated from "./Animated";
import animatedSource from "./Animated.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const progressExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `animated`, source: animatedSource, ...animated }
];

export const progressExampleById = (id: string): RegisteredExample => {
    const found = progressExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No progress example registered with id "${id}"`);
    return found;
};
