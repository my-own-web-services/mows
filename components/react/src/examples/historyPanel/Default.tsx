import { useEffect, useMemo } from "react";
import HistoryPanel from "../../../lib/components/appShell/historyPanel/HistoryPanel";
import {
    Action,
    ActionVisibility
} from "../../../lib/lib/mowsContext/ActionManager";
import { useMows } from "../../../lib/lib/mowsContext/MowsContext";
import type { ExampleModule } from "../harness/types";

/**
 * Populated history panel — dispatches three undoable actions on mount
 * so the example renders something meaningful without the user having
 * to interact first.
 */
const Example = () => {
    const mows = useMows();
    // Memoise so the registrations and dispatches happen once even when
    // the harness re-renders the example for state-tab updates.
    const sampleActionIds = useMemo(
        () => [
            { id: `example.history.rename`, category: `Files` },
            { id: `example.history.move`, category: `Files` },
            { id: `example.history.toggle-dark`, category: `Appearance` }
        ],
        []
    );

    useEffect(() => {
        for (const { id, category } of sampleActionIds) {
            if (mows.actionManager.getAction(id)) continue;
            mows.actionManager.defineAction(
                new Action({
                    id,
                    category,
                    actionHandlers: new Map([
                        [
                            `default`,
                            {
                                id: `default`,
                                getState: () => ({ visibility: ActionVisibility.Shown }),
                                executeAction: () => ({
                                    id: ``,
                                    actionId: id,
                                    inversePayload: { snapshot: `before` },
                                    timestamp: Date.now(),
                                    describe: { labelKey: `actions.${id}` }
                                }),
                                invertAction: () => undefined
                            }
                        ]
                    ])
                })
            );
        }
        for (const { id } of sampleActionIds) {
            mows.actionManager.dispatchAction(id);
        }
    }, [mows.actionManager, sampleActionIds]);

    return (
        <div className={`h-[480px] rounded-md border bg-card`}>
            <HistoryPanel className={`h-full`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.historyPanel.default,
    Example
};

export default module;
