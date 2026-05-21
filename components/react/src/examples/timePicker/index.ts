import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import twelveHour from "./TwelveHour";
import twelveHourSource from "./TwelveHour.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const timePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `twelveHour`, source: twelveHourSource, ...twelveHour }
];

export const timePickerExampleById = (id: string): RegisteredExample => {
    const found = timePickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No timePicker example registered with id "${id}"`);
    return found;
};
