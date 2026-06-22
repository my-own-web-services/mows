import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import responsive from "./Responsive";
import responsiveSource from "./Responsive.tsx?raw";
import variants from "./Variants";
import variantsSource from "./Variants.tsx?raw";
import granularity from "./Granularity";
import granularitySource from "./Granularity.tsx?raw";
import ranges from "./Ranges";
import rangesSource from "./Ranges.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const durationExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `responsive`, source: responsiveSource, ...responsive },
    { id: `variants`, source: variantsSource, ...variants },
    { id: `granularity`, source: granularitySource, ...granularity },
    { id: `ranges`, source: rangesSource, ...ranges }
];

export const durationExampleById = (id: string): RegisteredExample => {
    const found = durationExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No duration example registered with id "${id}"`);
    return found;
};
