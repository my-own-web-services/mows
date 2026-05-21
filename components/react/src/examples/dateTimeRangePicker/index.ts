import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const dateTimeRangePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule }
];

export const dateTimeRangePickerExampleById = (id: string): RegisteredExample => {
    const found = dateTimeRangePickerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No dateTimeRangePicker example registered with id "${id}"`);
    return found;
};
