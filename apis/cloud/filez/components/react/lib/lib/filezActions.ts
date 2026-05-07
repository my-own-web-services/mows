import {
    Action,
    ActionVisibility
} from "mows-components-react/lib/mowsContext/ActionManager";
import type { HotkeyConfig } from "mows-components-react/lib/mowsContext/HotkeyManager";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { useEffect } from "react";

export enum FilezActionIds {
    DELETE_FILES = `filez.files.delete`,
    DELETE_JOBS = `filez.jobs.delete`,
    CREATE_FILE_GROUP = `filez.fileGroups.create`
}

export const FilezModalTypes = {
    fileGroupCreate: `fileGroupCreate`,
    devTools: `devTools`
} as const;

export const filezExtraActions: Action[] = [
    new Action({
        id: FilezActionIds.DELETE_FILES,
        category: `File List`,
        doNotTrackUsage: false
    }),
    new Action({
        id: FilezActionIds.DELETE_JOBS,
        category: `Job List`,
        doNotTrackUsage: false
    }),
    new Action({
        id: FilezActionIds.CREATE_FILE_GROUP,
        category: `File Groups`
    })
];

export const filezExtraDefaultHotkeys: HotkeyConfig = {
    [FilezActionIds.DELETE_FILES]: { keyCombinations: [`delete`] },
    [FilezActionIds.DELETE_JOBS]: { keyCombinations: [`delete`] }
};

export const FilezActionHandlers = (): null => {
    const mows = useMows();
    useEffect(() => {
        const handler = {
            id: `FilezCreateFileGroup`,
            executeAction: () => mows.changeActiveModal(FilezModalTypes.fileGroupCreate),
            getState: () => ({ visibility: ActionVisibility.Shown })
        };
        mows.actionManager.registerActionHandler(FilezActionIds.CREATE_FILE_GROUP, handler);
        return () => {
            mows.actionManager.unregisterActionHandler(
                FilezActionIds.CREATE_FILE_GROUP,
                `FilezCreateFileGroup`
            );
        };
    }, [mows]);
    return null;
};
