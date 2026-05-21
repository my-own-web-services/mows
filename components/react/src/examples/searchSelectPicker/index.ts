import popover from "./Popover";
import popoverSource from "./Popover.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const searchSelectPickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `standalone`, source: standaloneSource, ...standalone },
    { id: `popover`, source: popoverSource, ...popover }
];

export const searchSelectPickerExampleById = (id: string): RegisteredExample => {
    const found = searchSelectPickerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No searchSelectPicker example registered with id "${id}"`);
    return found;
};
