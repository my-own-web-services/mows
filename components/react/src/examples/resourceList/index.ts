import contextMenuModule from "./ContextMenu";
import contextMenuSource from "./ContextMenu.tsx?raw";
import defaultModule from "./Default";
import defaultSource from "./Default.tsx?raw";
import gridModule from "./Grid";
import gridSource from "./Grid.tsx?raw";
import horizontalStripModule from "./HorizontalStrip";
import horizontalStripSource from "./HorizontalStrip.tsx?raw";
import multipleLayoutsModule from "./MultipleLayouts";
import multipleLayoutsSource from "./MultipleLayouts.tsx?raw";
import multipleListsSharedActionModule from "./MultipleListsSharedAction";
import multipleListsSharedActionSource from "./MultipleListsSharedAction.tsx?raw";
import selectionModule from "./Selection";
import selectionSource from "./Selection.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const resourceListExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultModule },
    { id: `grid`, source: gridSource, ...gridModule },
    { id: `multipleLayouts`, source: multipleLayoutsSource, ...multipleLayoutsModule },
    { id: `selection`, source: selectionSource, ...selectionModule },
    { id: `contextMenu`, source: contextMenuSource, ...contextMenuModule },
    {
        id: `multipleListsSharedAction`,
        source: multipleListsSharedActionSource,
        ...multipleListsSharedActionModule
    },
    { id: `horizontalStrip`, source: horizontalStripSource, ...horizontalStripModule }
];

export const resourceListExampleById = (id: string): RegisteredExample => {
    const found = resourceListExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No resourceList example registered with id "${id}"`);
    return found;
};
