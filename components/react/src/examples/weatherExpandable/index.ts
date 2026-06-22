import collapsedModule from "./Collapsed";
import collapsedSource from "./Collapsed.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import headerOnlyModule from "./HeaderOnly";
import headerOnlySource from "./HeaderOnly.tsx?raw";
import iconsModule from "./Icons";
import iconsSource from "./Icons.tsx?raw";
import localisedModule from "./Localised";
import localisedSource from "./Localised.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const weatherExpandableExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `collapsed`, source: collapsedSource, ...collapsedModule },
    { id: `headerOnly`, source: headerOnlySource, ...headerOnlyModule },
    { id: `icons`, source: iconsSource, ...iconsModule },
    { id: `localised`, source: localisedSource, ...localisedModule }
];

export const weatherExpandableExampleById = (id: string): RegisteredExample => {
    const found = weatherExpandableExamples.find((example) => example.id === id);
    if (!found)
        throw new Error(`No weatherExpandable example registered with id "${id}"`);
    return found;
};
