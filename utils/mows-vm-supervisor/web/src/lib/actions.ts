// Right-click actions for sidebar VM and agent rows.
//
// The GlobalContextMenu only opens on elements that have an ancestor with
// `data-actionscope=<scope>`. We register two scopes — `vm-row` and
// `agent-row` — and stash the right-clicked row's target id in a module-
// scoped singleton so handlers (called with no event context) can look it
// up. The capture-phase listener runs before GlobalContextMenu's document
// listener, so by the time an action fires the target id is already set.

import {
    Action,
    ActionVisibility
} from "@mows/react-components/lib/mowsContext/ActionManager";
import { Pencil, Square, Trash2 } from "lucide-react";
import { createElement, type JSX } from "react";
import { toast } from "sonner";
import {
    deleteAgent,
    deleteVm,
    describeApiError,
    renameAgent,
    renameVm,
    stopAgent,
    stopVm
} from "./api";
import { requestConfirm, requestPrompt } from "./modals";

export enum WebActionIds {
    STOP_VM = "supervisor.vm.stop",
    RENAME_VM = "supervisor.vm.rename",
    DELETE_VM = "supervisor.vm.delete",
    STOP_AGENT = "supervisor.agent.stop",
    RENAME_AGENT = "supervisor.agent.rename",
    DELETE_AGENT = "supervisor.agent.delete"
}

export const VM_ROW_SCOPE = "vm-row";
export const AGENT_ROW_SCOPE = "agent-row";

interface ContextTarget {
    scope: string;
    id: string;
    name: string | null;
    status: string | null;
}

let contextTarget: ContextTarget | null = null;

// Capture-phase `contextmenu` listener that captures the right-clicked
// element's `data-actionscope` / `data-action-target-id` payload so the
// action handler can read it without re-traversing the DOM.
//
// Wrapped in `registerContextScopeListener()` so module import is
// side-effect-free; `main.tsx` calls it once at boot. Returns the
// cleanup function so HMR can `import.meta.hot?.dispose(cleanup)` and
// avoid stacking duplicate listeners across hot reloads (TASTE-15).
export const registerContextScopeListener = (): (() => void) => {
    const onContextMenu = (event: Event) => {
        const target = (event.target as HTMLElement | null)?.closest?.(
            "[data-actionscope]"
        ) as HTMLElement | null;
        if (!target) {
            contextTarget = null;
            return;
        }
        const scope = target.getAttribute("data-actionscope");
        const id = target.getAttribute("data-action-target-id");
        if (!scope || !id) {
            contextTarget = null;
            return;
        }
        contextTarget = {
            scope,
            id,
            name: target.getAttribute("data-action-target-name"),
            status: target.getAttribute("data-action-target-status")
        };
    };
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => document.removeEventListener("contextmenu", onContextMenu, true);
};

const isLive = (status: string | null): boolean =>
    status !== null &&
    status !== "stopped" &&
    status !== "failed" &&
    status !== "exited";

const handler = (
    actionId: string,
    expectedScope: string,
    onInvoke: (target: ContextTarget) => Promise<void> | void,
    icon: () => JSX.Element,
    visibility: (target: ContextTarget | null) => ActionVisibility = () =>
        ActionVisibility.Shown
) => ({
    id: actionId,
    scopes: [expectedScope],
    executeAction: () => {
        const target = contextTarget;
        if (!target || target.scope !== expectedScope) {
            toast.error("no target");
            return;
        }
        Promise.resolve(onInvoke(target)).catch(async (error) =>
            toast.error(await describeApiError(error))
        );
    },
    getState: () => ({
        visibility: visibility(contextTarget),
        icon
    })
});

const stopIcon = () => createElement(Square);
const renameIcon = () => createElement(Pencil);
const deleteIcon = () => createElement(Trash2);

export const buildExtraActions = (): Action[] => [
    new Action({
        id: WebActionIds.STOP_VM,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "vm-row",
                handler(
                    WebActionIds.STOP_VM,
                    VM_ROW_SCOPE,
                    async (target) => {
                        await stopVm(target.id);
                        toast.success(`stopping ${target.name ?? target.id}`);
                    },
                    stopIcon,
                    (target) =>
                        isLive(target?.status ?? null)
                            ? ActionVisibility.Shown
                            : ActionVisibility.Disabled
                )
            ]
        ])
    }),
    new Action({
        id: WebActionIds.RENAME_VM,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "vm-row",
                handler(
                    WebActionIds.RENAME_VM,
                    VM_ROW_SCOPE,
                    async (target) => {
                        const next = await requestPrompt({
                            title: "Rename VM",
                            description: `Current name: ${target.name ?? target.id}`,
                            initial: target.name ?? "",
                            placeholder: "new VM name",
                            confirmLabel: "Rename"
                        });
                        if (next === null) return;
                        const trimmed = next.trim();
                        if (!trimmed || trimmed === target.name) return;
                        await renameVm(target.id, trimmed);
                        toast.success(`renamed to ${trimmed}`);
                    },
                    renameIcon
                )
            ]
        ])
    }),
    new Action({
        id: WebActionIds.DELETE_VM,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "vm-row",
                handler(
                    WebActionIds.DELETE_VM,
                    VM_ROW_SCOPE,
                    async (target) => {
                        const ok = await requestConfirm({
                            title: "Delete VM?",
                            description: `Delete "${target.name ?? target.id}"?\n\nThis removes the VM and every on-disk artefact tied to it. This cannot be undone.`,
                            confirmLabel: "Delete",
                            danger: true
                        });
                        if (!ok) return;
                        await deleteVm(target.id);
                        toast.success(`deleted ${target.name ?? target.id}`);
                    },
                    deleteIcon
                )
            ]
        ])
    }),
    new Action({
        id: WebActionIds.STOP_AGENT,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "agent-row",
                handler(
                    WebActionIds.STOP_AGENT,
                    AGENT_ROW_SCOPE,
                    async (target) => {
                        await stopAgent(target.id);
                        toast.success(`stopping ${target.name ?? target.id}`);
                    },
                    stopIcon,
                    (target) =>
                        isLive(target?.status ?? null)
                            ? ActionVisibility.Shown
                            : ActionVisibility.Disabled
                )
            ]
        ])
    }),
    new Action({
        id: WebActionIds.RENAME_AGENT,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "agent-row",
                handler(
                    WebActionIds.RENAME_AGENT,
                    AGENT_ROW_SCOPE,
                    async (target) => {
                        const next = await requestPrompt({
                            title: "Rename agent",
                            description: `Current name: ${target.name ?? target.id}`,
                            initial: target.name ?? "",
                            placeholder: "new agent name",
                            confirmLabel: "Rename"
                        });
                        if (next === null) return;
                        const trimmed = next.trim();
                        if (!trimmed || trimmed === target.name) return;
                        await renameAgent(target.id, trimmed);
                        toast.success(`renamed to ${trimmed}`);
                    },
                    renameIcon
                )
            ]
        ])
    }),
    new Action({
        id: WebActionIds.DELETE_AGENT,
        category: "Supervisor",
        actionHandlers: new Map([
            [
                "agent-row",
                handler(
                    WebActionIds.DELETE_AGENT,
                    AGENT_ROW_SCOPE,
                    async (target) => {
                        const ok = await requestConfirm({
                            title: "Delete agent?",
                            description: `Delete "${target.name ?? target.id}"?\n\nThis removes the agent and its on-disk state. The VM stays running.`,
                            confirmLabel: "Delete",
                            danger: true
                        });
                        if (!ok) return;
                        await deleteAgent(target.id);
                        toast.success(`deleted ${target.name ?? target.id}`);
                    },
                    deleteIcon
                )
            ]
        ])
    })
];
