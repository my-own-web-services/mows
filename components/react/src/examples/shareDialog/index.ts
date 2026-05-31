import allowDenyModule from "./AllowDeny";
import allowDenySource from "./AllowDeny.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import publicOnlyModule from "./PublicOnly";
import publicOnlySource from "./PublicOnly.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const shareDialogExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `allowDeny`, source: allowDenySource, ...allowDenyModule },
    { id: `publicOnly`, source: publicOnlySource, ...publicOnlyModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const shareDialogExampleById = (id: string): RegisteredExample => {
    const found = shareDialogExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No shareDialog example registered with id "${id}"`);
    return found;
};
