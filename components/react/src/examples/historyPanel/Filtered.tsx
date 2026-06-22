import DefaultExample from "./Default";
import HistoryPanel from "../../../lib/components/appShell/historyPanel/HistoryPanel";
import { useMows } from "../../../lib/lib/mowsContext/MowsContext";
import type { ExampleModule } from "../harness/types";
import { useEffect } from "react";

/**
 * Same dispatch sequence as the Default mode, but presented with a
 * frame label that hints the panel should be opened with the search +
 * category filter exercised. The Default example dispatches the
 * sample actions; this one just renders the panel on top of them.
 */
const Example = () => {
    const mows = useMows();
    // Reuse the same dispatch logic by mounting the Default example
    // hidden, then rendering our own panel — that way both modes show
    // the same data.
    useEffect(() => {
        const hidden = document.createElement(`div`);
        hidden.style.display = `none`;
        document.body.appendChild(hidden);
        return () => {
            hidden.remove();
        };
    }, []);

    return (
        <div className={`flex h-[480px] flex-col gap-2 rounded-md border bg-card p-3`}>
            <p className={`text-muted-foreground text-xs`}>
                Try typing "rename" in the search box, or selecting the "Files"
                category to narrow the list. Reverse-tab note: the open action is
                `mows.history.open`; this preview skips the modal and renders the
                panel inline so you can interact with the filters directly.
            </p>
            <div className={`min-h-0 flex-1`}>
                <HistoryPanel className={`h-full`} />
            </div>
            <div className={`hidden`}>
                <DefaultExample.Example />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.historyPanel.filtered,
    Example
};

export default module;
