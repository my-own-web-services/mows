import popover from "./Popover";
import popoverSource from "./Popover.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const themePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `popover`, source: popoverSource, ...popover },
    { id: `standalone`, source: standaloneSource, ...standalone }
];

export const themePickerExampleById = (id: string): RegisteredExample => {
    const found = themePickerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No themePicker example registered with id "${id}"`);
    return found;
};
