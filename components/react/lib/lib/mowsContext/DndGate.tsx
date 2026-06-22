import type { ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// Lazy chunk: isolates the `react-dnd` import so it is only fetched when
// `<MowsProvider>` is rendered with drag-and-drop enabled (the default). Apps
// that pass `dnd={false}` never load it. See MowsContext.tsx.
export default function DndGate({ children }: { children: ReactNode }) {
    return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
