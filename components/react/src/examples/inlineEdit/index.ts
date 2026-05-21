import basic from "./Basic";
import basicSource from "./Basic.tsx?raw";
import heading from "./Heading";
import headingSource from "./Heading.tsx?raw";
import placeholder from "./Placeholder";
import placeholderSource from "./Placeholder.tsx?raw";
import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import fixedWidth from "./FixedWidth";
import fixedWidthSource from "./FixedWidth.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const inlineEditExamples: ReadonlyArray<RegisteredExample> = [
    { id: `basic`, source: basicSource, ...basic },
    { id: `heading`, source: headingSource, ...heading },
    { id: `placeholder`, source: placeholderSource, ...placeholder },
    { id: `fixedWidth`, source: fixedWidthSource, ...fixedWidth },
    { id: `disabled`, source: disabledSource, ...disabled }
];

export const inlineEditExampleById = (id: string): RegisteredExample => {
    const found = inlineEditExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No inlineEdit example registered with id "${id}"`);
    return found;
};
