import collapsibleGroups from "./CollapsibleGroups";
import collapsibleGroupsSource from "./CollapsibleGroups.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import resizable from "./Resizable";
import resizableSource from "./Resizable.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const sidebarExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `collapsibleGroups`, source: collapsibleGroupsSource, ...collapsibleGroups },
    { id: `resizable`, source: resizableSource, ...resizable }
];

export const sidebarExampleById = (id: string): RegisteredExample => {
    const found = sidebarExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No sidebar example registered with id "${id}"`);
    return found;
};
