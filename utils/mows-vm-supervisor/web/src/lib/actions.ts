// Web-UI extra actions, registered with `MowsProvider`'s `extraActions` prop.
// These light up in the global Command Palette (Ctrl-K) and are also
// invocable programmatically via `actionManager.executeAction(id)`.
//
// State that handlers need (current VM id from the URL, refresh callbacks,
// etc.) is shared via a tiny mutable singleton — `webUiContext` — that the
// pages update whenever they mount/unmount. The MowsProvider only takes a
// snapshot of actions at construction time, so handlers must close over this
// indirection rather than over component state.

import { Action, ActionVisibility } from "mows-components-react/lib/mowsContext/ActionManager";
import { toast } from "sonner";
import { createAgent, createVm, listAgents, listVms } from "./api";

export enum WebActionIds {
    REFRESH = "supervisor.refresh",
    CREATE_VM = "supervisor.vm.create",
    CREATE_CLAUDE_AGENT = "supervisor.agent.createClaude",
    CREATE_SHELL_AGENT = "supervisor.agent.createShell",
    COPY_CLI = "supervisor.copyCliInvocation"
}

interface WebUiContext {
    /** Currently displayed VM id (when on the detail page), else null. */
    currentVmId: string | null;
    /** A page-supplied refresh callback so actions can re-poll data. */
    refresh: (() => void) | null;
}

export const webUiContext: WebUiContext = {
    currentVmId: null,
    refresh: null
};

const handler = (
    id: string,
    fn: () => Promise<void> | void,
    visibility: () => ActionVisibility = () => ActionVisibility.Shown,
    disabledReasonText?: string
) =>
    new Map([
        [
            id,
            {
                id,
                executeAction: () => {
                    Promise.resolve(fn()).catch((e) => toast.error(String(e)));
                },
                getState: () => ({
                    visibility: visibility(),
                    disabledReasonText
                })
            }
        ]
    ]);

const requireVmContext = (): ActionVisibility =>
    webUiContext.currentVmId ? ActionVisibility.Shown : ActionVisibility.Disabled;

export const buildExtraActions = (): Action[] => [
    new Action({
        id: WebActionIds.REFRESH,
        category: "Supervisor",
        actionHandlers: handler(WebActionIds.REFRESH, () => {
            const fn = webUiContext.refresh;
            if (fn) {
                fn();
                toast.success("refreshed");
            } else {
                // The list page registers a refresh callback. Fall back to a
                // best-effort fetch so the action never silently no-ops.
                Promise.all([listVms(), listAgents()])
                    .then(() => toast.success("refreshed"))
                    .catch((e) => toast.error(String(e)));
            }
        })
    }),
    new Action({
        id: WebActionIds.CREATE_VM,
        category: "Supervisor",
        actionHandlers: handler(WebActionIds.CREATE_VM, async () => {
            const vm = await createVm({});
            toast.success(`vm ${vm.name} created`);
            webUiContext.refresh?.();
        })
    }),
    new Action({
        id: WebActionIds.CREATE_CLAUDE_AGENT,
        category: "Supervisor",
        actionHandlers: handler(
            WebActionIds.CREATE_CLAUDE_AGENT,
            async () => {
                const id = webUiContext.currentVmId!;
                const agent = await createAgent(id, { kind: "claude" });
                toast.success(`spawning claude in ${agent.vm_id.slice(0, 8)}`);
            },
            requireVmContext,
            "open a VM detail page first"
        )
    }),
    new Action({
        id: WebActionIds.CREATE_SHELL_AGENT,
        category: "Supervisor",
        actionHandlers: handler(
            WebActionIds.CREATE_SHELL_AGENT,
            async () => {
                const id = webUiContext.currentVmId!;
                const agent = await createAgent(id, { kind: "shell" });
                toast.success(`spawning shell in ${agent.vm_id.slice(0, 8)}`);
            },
            requireVmContext,
            "open a VM detail page first"
        )
    }),
    new Action({
        id: WebActionIds.COPY_CLI,
        category: "Supervisor",
        actionHandlers: handler(
            WebActionIds.COPY_CLI,
            async () => {
                const id = webUiContext.currentVmId;
                const cmd = id
                    ? `mows agents create ${id} --kind claude`
                    : "mows agents run";
                await navigator.clipboard.writeText(cmd);
                toast.success(`copied: ${cmd}`);
            }
        )
    })
];
