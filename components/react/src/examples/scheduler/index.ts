import agendaOnly from "./AgendaOnly";
import agendaOnlySource from "./AgendaOnly.tsx?raw";
import businessHours from "./BusinessHours";
import businessHoursSource from "./BusinessHours.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import localized from "./Localized";
import localizedSource from "./Localized.tsx?raw";
import selection from "./Selection";
import selectionSource from "./Selection.tsx?raw";

import type { RegisteredExample } from "../harness/types";

export const schedulerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `selection`, source: selectionSource, ...selection },
    { id: `agendaOnly`, source: agendaOnlySource, ...agendaOnly },
    { id: `localized`, source: localizedSource, ...localized },
    { id: `businessHours`, source: businessHoursSource, ...businessHours }
];

export const schedulerExampleById = (id: string): RegisteredExample => {
    const found = schedulerExamples.find((example) => example.id === id);
    if (!found) {
        throw new Error(`No scheduler example registered with id "${id}"`);
    }
    return found;
};
