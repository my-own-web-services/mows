import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import disableFuture from "./DisableFuture";
import disableFutureSource from "./DisableFuture.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const calendarExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `disableFuture`, source: disableFutureSource, ...disableFuture }
];

export const calendarExampleById = (id: string): RegisteredExample => {
    const found = calendarExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No calendar example registered with id "${id}"`);
    return found;
};
