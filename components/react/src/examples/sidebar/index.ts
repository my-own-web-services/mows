import collapsibleGroups from "./CollapsibleGroups";
import collapsibleGroupsSource from "./CollapsibleGroups.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import flush from "./Flush";
import flushSource from "./Flush.tsx?raw";
import iconCollapsible from "./IconCollapsible";
import iconCollapsibleSource from "./IconCollapsible.tsx?raw";
import resizable from "./Resizable";
import resizableSource from "./Resizable.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const sidebarExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `flush`, source: flushSource, ...flush },
    { id: `iconCollapsible`, source: iconCollapsibleSource, ...iconCollapsible },
    { id: `collapsibleGroups`, source: collapsibleGroupsSource, ...collapsibleGroups },
    { id: `resizable`, source: resizableSource, ...resizable }
];

export const sidebarExampleById = (id: string): RegisteredExample => {
    const found = sidebarExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No sidebar example registered with id "${id}"`);
    return found;
};
