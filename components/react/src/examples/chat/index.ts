import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import endlessModule from "./Endless";
import endlessSource from "./Endless.tsx?raw";
import readOnlyModule from "./ReadOnly";
import readOnlySource from "./ReadOnly.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const chatExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `endless`, source: endlessSource, ...endlessModule },
    { id: `readOnly`, source: readOnlySource, ...readOnlyModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const chatExampleById = (id: string): RegisteredExample => {
    const found = chatExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No chat example registered with id "${id}"`);
    return found;
};
