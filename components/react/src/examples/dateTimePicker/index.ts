import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import withTimezone from "./WithTimezone";
import withTimezoneSource from "./WithTimezone.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const dateTimePickerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `withTimezone`, source: withTimezoneSource, ...withTimezone }
];

export const dateTimePickerExampleById = (id: string): RegisteredExample => {
    const found = dateTimePickerExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No dateTimePicker example registered with id "${id}"`);
    return found;
};
