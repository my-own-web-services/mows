import popover from "./Popover";
import popoverSource from "./Popover.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const mapStylePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `popover`, source: popoverSource, ...popover },
    { id: `standalone`, source: standaloneSource, ...standalone }
];

export const mapStylePickerExampleById = (id: string): RegisteredExample => {
    const found = mapStylePickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No mapStylePicker example registered with id "${id}"`);
    return found;
};
