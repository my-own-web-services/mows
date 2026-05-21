import iconOnly from "./IconOnly";
import iconOnlySource from "./IconOnly.tsx?raw";
import label from "./Label";
import labelSource from "./Label.tsx?raw";
import withToast from "./WithToast";
import withToastSource from "./WithToast.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const copyValueButtonExamples: ReadonlyArray<RegisteredExample> = [
    { id: `label`, source: labelSource, ...label },
    { id: `iconOnly`, source: iconOnlySource, ...iconOnly },
    { id: `withToast`, source: withToastSource, ...withToast }
];

export const copyValueButtonExampleById = (id: string): RegisteredExample => {
    const found = copyValueButtonExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No copyValueButton example registered with id "${id}"`);
    return found;
};
