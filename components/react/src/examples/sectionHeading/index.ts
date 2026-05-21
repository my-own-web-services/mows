import defaultExample from "./Default";
import defaultSource from "./Default.tsx?raw";
import levels from "./Levels";
import levelsSource from "./Levels.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const sectionHeadingExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultExample },
    { id: `levels`, source: levelsSource, ...levels }
];

export const sectionHeadingExampleById = (id: string): RegisteredExample => {
    const found = sectionHeadingExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No sectionHeading example registered with id "${id}"`);
    return found;
};
