import decimal from "./Decimal";
import decimalSource from "./Decimal.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const numberInputExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `decimal`, source: decimalSource, ...decimal }
];

export const numberInputExampleById = (id: string): RegisteredExample => {
    const found = numberInputExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No numberInput example registered with id "${id}"`);
    return found;
};
