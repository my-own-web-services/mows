import { useEffect } from "react";
import HistoryPanel from "../../../lib/components/appShell/historyPanel/HistoryPanel";
import { useMows } from "../../../lib/lib/mowsContext/MowsContext";
import type { ExampleModule } from "../harness/types";

/**
 * Empty-state mode — clears the audit log on mount so the panel renders
 * only the "No actions yet" copy.
 */
const Example = () => {
    const mows = useMows();
    useEffect(() => {
        mows.actionManager.clearHistory();
    }, [mows.actionManager]);

    return (
        <div className={`h-[320px] rounded-md border bg-card`}>
            <HistoryPanel className={`h-full`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.historyPanel.empty,
    Example
};

export default module;
