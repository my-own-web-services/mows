import popover from "./Popover";
import popoverSource from "./Popover.tsx?raw";
import standalone from "./Standalone";
import standaloneSource from "./Standalone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const languagePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `popover`, source: popoverSource, ...popover },
    { id: `standalone`, source: standaloneSource, ...standalone }
];

export const languagePickerExampleById = (id: string): RegisteredExample => {
    const found = languagePickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No languagePicker example registered with id "${id}"`);
    return found;
};
