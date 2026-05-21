import popover from "./Popover";
import popoverSource from "./Popover.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const codeThemePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `popover`, source: popoverSource, ...popover },
    { id: `standalone`, source: standaloneSource, ...standalone }
];

export const codeThemePickerExampleById = (id: string): RegisteredExample => {
    const found = codeThemePickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No codeThemePicker example registered with id "${id}"`);
    return found;
};
