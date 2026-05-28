import closedModule from "./Closed";
import closedSource from "./Closed.tsx?raw";
import closingSoonModule from "./ClosingSoon";
import closingSoonSource from "./ClosingSoon.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import weekOnlyModule from "./WeekOnly";
import weekOnlySource from "./WeekOnly.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const openingHoursExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `closingSoon`, source: closingSoonSource, ...closingSoonModule },
    { id: `closed`, source: closedSource, ...closedModule },
    { id: `weekOnly`, source: weekOnlySource, ...weekOnlyModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const openingHoursExampleById = (id: string): RegisteredExample => {
    const found = openingHoursExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No openingHours example registered with id "${id}"`);
    return found;
};
