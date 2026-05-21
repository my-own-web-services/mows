import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import range from "./Range";
import rangeSource from "./Range.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const sliderExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `range`, source: rangeSource, ...range },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const sliderExampleById = (id: string): RegisteredExample => {
    const found = sliderExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No slider example registered with id "${id}"`);
    return found;
};
