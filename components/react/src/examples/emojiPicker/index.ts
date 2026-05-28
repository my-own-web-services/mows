import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import inPopoverModule from "./InPopover";
import inPopoverSource from "./InPopover.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const emojiPickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `inPopover`, source: inPopoverSource, ...inPopoverModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const emojiPickerExampleById = (id: string): RegisteredExample => {
    const found = emojiPickerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No emojiPicker example registered with id "${id}"`);
    return found;
};
