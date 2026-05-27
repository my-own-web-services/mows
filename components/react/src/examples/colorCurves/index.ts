import photo from "./Photo";
import photoSource from "./Photo.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const colorCurvesExamples: ReadonlyArray<RegisteredExample> = [
    { id: `photo`, source: photoSource, ...photo },
    { id: `standalone`, source: standaloneSource, ...standalone }
];

export const colorCurvesExampleById = (id: string): RegisteredExample => {
    const found = colorCurvesExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No colorCurves example registered with id "${id}"`);
    return found;
};
