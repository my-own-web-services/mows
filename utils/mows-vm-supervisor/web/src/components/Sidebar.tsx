// Sidebar matching the shadcn "Platform > Models > Genesis…" example:
//   • a SidebarGroup with optional label
//   • each section is a SidebarMenuItem wrapping a Collapsible
//   • trigger is a full-width SidebarMenuButton with icon + label + chevron
//   • body is a SidebarMenuSub with one SidebarMenuSubButton per item
// Each section fetches its endpoint once on mount and re-fetches whenever
// a matching supervisor event arrives over the `/v1/events` websocket —
// no periodic polling. Rows expose `data-actionscope` +
// `data-action-target-id` so the app-wide GlobalContextMenu can pick up
// VM / Agent right-click actions registered in lib/actions.ts.

import PrimaryMenu from "@my-own-web-services/react-components/components/appShell/primaryMenu/PrimaryMenu";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@my-own-web-services/react-components/components/ui/collapsible";
import {
    SidebarContent,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem
} from "@my-own-web-services/react-components/components/ui/sidebar";
import { useMows } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { Bot, ChevronRight, Plus, Server, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    AGENT_ROW_SCOPE,
    VM_ROW_SCOPE
} from "../lib/actions";
import {
    createVm,
    describeApiError,
    listAgents,
    listVms,
    type AgentSummary,
    type CreateVmRequest,
    type VmSummary
} from "../lib/api";
import { subscribeEvents, type SupervisorEvent } from "../lib/events";
import {
    VmDisplayMode,
    VmImage
} from "../api/generated/api-client";
import { requestNewVm } from "../lib/modals";

const statusDot = (status: string): string => {
    if (status === "running") return "bg-emerald-500";
    if (status === "starting" || status === "stopping")
        return "bg-amber-500 animate-pulse";
    if (status === "failed") return "bg-red-500";
    return "bg-muted-foreground/40";
};

interface SectionState<T> {
    items: T[] | null;
    error: string | null;
}

interface SectionHandle<T> {
    state: SectionState<T>;
    refresh: () => Promise<void>;
}

/**
 * Fetch once on mount, then re-fetch every time `eventFilter(event)`
 * returns true. Replaces the previous 2 s `setInterval` polling loop.
 *
 * `fetcher` and `eventFilter` references must be stable across renders
 * (typically module-scope or `useCallback`-wrapped) — the effect runs
 * only once.
 */
const useLiveData = <T,>(
    fetcher: () => Promise<T[]>,
    eventFilter: (event: SupervisorEvent) => boolean
): SectionHandle<T> => {
    const [state, setState] = useState<SectionState<T>>({
        items: null,
        error: null
    });

    const refresh = async () => {
        try {
            const items = await fetcher();
            setState({ items, error: null });
        } catch (error) {
            const errorText = await describeApiError(error);
            setState((prev) => ({ items: prev.items, error: errorText }));
        }
    };

    useEffect(() => {
        let alive = true;
        const safeRefresh = async () => {
            if (!alive) return;
            await refresh();
        };
        safeRefresh();
        const unsubscribe = subscribeEvents((event) => {
            // `resync` is a synthetic event the WS client fires after each
            // reconnect — refetch unconditionally so we recover from a
            // dropped connection.
            if (event.type === "resync" || eventFilter(event)) {
                safeRefresh();
            }
        });
        return () => {
            alive = false;
            unsubscribe();
        };
        // fetcher / eventFilter are stable per call site (module scope).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { state, refresh };
};

const isVmEvent = (event: SupervisorEvent): boolean =>
    event.type === "vm_created" ||
    event.type === "vm_updated" ||
    event.type === "vm_deleted";

const isAgentEvent = (event: SupervisorEvent): boolean =>
    event.type === "agent_created" ||
    event.type === "agent_updated" ||
    event.type === "agent_deleted";

interface SectionAction {
    icon: LucideIcon;
    label: string;
    onClick: () => void | Promise<void>;
}

interface SectionProps<T> {
    title: string;
    icon: LucideIcon;
    loading: string;
    empty: string;
    error: string;
    state: SectionState<T>;
    renderSubItem: (item: T) => React.ReactNode;
    headerAction?: SectionAction;
}

const Section = <T,>({
    title,
    icon: Icon,
    loading,
    empty,
    error,
    state,
    renderSubItem,
    headerAction
}: SectionProps<T>) => (
    <Collapsible asChild defaultOpen className="group/collapsible">
        <SidebarMenuItem>
            <div className="flex w-full items-center">
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={title}
                        className="flex-1 cursor-pointer"
                    >
                        <Icon />
                        <span>{title}</span>
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                {headerAction && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={headerAction.label}
                        title={headerAction.label}
                        onClick={(e) => {
                            e.stopPropagation();
                            Promise.resolve(headerAction.onClick()).catch(
                                async (err) => toast.error(await describeApiError(err))
                            );
                        }}
                        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ml-1 size-7 shrink-0"
                    >
                        <headerAction.icon className="size-4" aria-hidden />
                    </Button>
                )}
            </div>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {state.error && state.items === null ? (
                        <li className="text-destructive px-2 py-1 text-xs">
                            {error}: {state.error}
                        </li>
                    ) : state.items === null ? (
                        <li className="text-muted-foreground px-2 py-1 text-xs">
                            {loading}
                        </li>
                    ) : state.items.length === 0 ? (
                        <li className="text-muted-foreground px-2 py-1 text-xs italic">
                            {empty}
                        </li>
                    ) : (
                        state.items.map(renderSubItem)
                    )}
                </SidebarMenuSub>
            </CollapsibleContent>
        </SidebarMenuItem>
    </Collapsible>
);

const Sidebar = () => {
    const { t } = useMows();
    // The Sidebar is mounted above `<Routes>`, so `useParams` would always
    // return `{}`. `useMatch` reads the location directly, which lets us
    // highlight the active VM row regardless of mount depth.
    const vmMatch = useMatch("/vms/:id");
    const activeVmId = vmMatch?.params.id;
    const navigate = useNavigate();
    const vms = useLiveData<VmSummary>(listVms, isVmEvent);
    const agents = useLiveData<AgentSummary>(listAgents, isAgentEvent);

    return (
        <div className="text-sidebar-foreground flex h-full w-full min-h-0 flex-col">
            <SidebarContent className="min-h-0 flex-1">
                <SidebarGroup>
                    <SidebarMenu>
                        <Section
                            title={t.supervisor.sidebar.vms.title}
                            icon={Server}
                            loading={t.supervisor.sidebar.vms.loading}
                            empty={t.supervisor.sidebar.vms.empty}
                            error={t.supervisor.sidebar.error}
                            state={vms.state}
                            headerAction={{
                                icon: Plus,
                                label: t.supervisor.sidebar.vms.newVm,
                                onClick: async () => {
                                    const form = await requestNewVm({
                                        title: t.supervisor.sidebar.vms.newVm
                                    });
                                    if (!form) return;
                                    const createVmPayload: CreateVmRequest = {
                                        image: form.image as VmImage,
                                        display_mode: form.displayMode as VmDisplayMode
                                    };
                                    if (form.name.trim()) createVmPayload.name = form.name.trim();
                                    if (form.cwd.trim()) createVmPayload.cwd = form.cwd.trim();
                                    if (form.cpus !== null) createVmPayload.cpus = form.cpus;
                                    if (form.memoryMb !== null)
                                        createVmPayload.memory_mb = form.memoryMb;
                                    const vm = await createVm(createVmPayload);
                                    toast.success(`created ${vm.name}`);
                                    vms.refresh();
                                    navigate(`/vms/${vm.id}`);
                                }
                            }}
                            renderSubItem={(vm) => (
                                <SidebarMenuSubItem
                                    key={vm.id}
                                    data-actionscope={VM_ROW_SCOPE}
                                    data-action-target-id={vm.id}
                                    data-action-target-name={vm.name}
                                    data-action-target-status={vm.status}
                                >
                                    <SidebarMenuSubButton
                                        asChild
                                        isActive={activeVmId === vm.id}
                                        className="cursor-pointer data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold"
                                    >
                                        <Link
                                            to={`/vms/${vm.id}`}
                                            title={`${vm.name} · ${vm.status}`}
                                        >
                                            <span
                                                className={`${statusDot(vm.status)} size-2 shrink-0 rounded-full`}
                                            />
                                            <span className="truncate">{vm.name}</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            )}
                        />
                        <Section
                            title={t.supervisor.sidebar.agents.title}
                            icon={Bot}
                            loading={t.supervisor.sidebar.agents.loading}
                            empty={t.supervisor.sidebar.agents.empty}
                            error={t.supervisor.sidebar.error}
                            state={agents.state}
                            renderSubItem={(agent) => (
                                <SidebarMenuSubItem
                                    key={agent.id}
                                    data-actionscope={AGENT_ROW_SCOPE}
                                    data-action-target-id={agent.id}
                                    data-action-target-name={agent.name}
                                    data-action-target-status={agent.status}
                                >
                                    <SidebarMenuSubButton
                                        className="cursor-pointer"
                                        title={`${agent.kind} · ${agent.name} · ${agent.status}`}
                                    >
                                        <span
                                            className={`${statusDot(agent.status)} size-2 shrink-0 rounded-full`}
                                        />
                                        <span className="text-muted-foreground font-mono text-[10px]">
                                            {agent.kind}
                                        </span>
                                        <span className="truncate">{agent.name}</span>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            )}
                        />
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            {/* Inline PrimaryMenu brings its own top border and edge-to-edge
                padding so it sits flush as the sidebar's bottom bar. */}
            <PrimaryMenu variant="inline" />
        </div>
    );
};

export default Sidebar;
