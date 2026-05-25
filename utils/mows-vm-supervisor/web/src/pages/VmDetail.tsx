// VM detail panel — shown when a sidebar VM row is clicked.
//
// Layout (single column, two-column on wider screens for the bottom row):
//   ┌─────────────────────────────────────────────────────────────┐
//   │   ●  profitable-viper                          [...]        │
//   │      running · started 5 minutes ago                        │
//   ├──────────────┬──────────────┬──────────────┬───────────────┤
//   │  CPU         │  Memory      │  Uptime      │  Agents       │
//   │  2 vCPU      │  2 GB        │  5m 12s      │  0            │
//   ├──────────────┴──────────────┴──────────────┴───────────────┤
//   │   Connection                                                │
//   │     SSH      ssh -p 32145 root@127.0.0.1     [copy]        │
//   │     Docker   tcp://127.0.0.1:32146           [copy]        │
//   │     Cwd      /home/paul/projects/foo         [copy]        │
//   ├─────────────────────────────────────────────────────────────┤
//   │   Agents in this VM                                         │
//   │     (live list)                                             │
//   └─────────────────────────────────────────────────────────────┘
//
// Fetches `/v1/vms/{id}` once on mount and re-fetches on every matching
// supervisor event (`vm_updated` / `vm_deleted` for this VM, plus the
// synthetic `resync` after a WS reconnect). A separate 1 s ticker keeps
// the relative-time + uptime stat fresh between data refreshes.

import {
    Card,
    CardContent
} from "@mows/react-components/components/ui/card";
import InlineEdit from "@mows/react-components/components/input/inlineEdit/InlineEdit";
import ConsoleManager, {
    type ConsoleType
} from "@mows/react-components/components/console/consoleManager/ConsoleManager";
import { useMows } from "@mows/react-components/lib/mowsContext/MowsContext";
import {
    Bot,
    Clock,
    Cpu,
    HardDrive,
    MemoryStick,
    Server,
    TerminalSquare
} from "lucide-react";
import VmSshConsole from "../components/VmSshConsole";
import {
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, describeApiError, renameVm } from "../lib/api";
import { subscribeEvents } from "../lib/events";
import {
    formatBytes,
    formatDuration,
    formatRelative
} from "../lib/format";
import type { VmSummary } from "../api/generated/api-client";

// Visual treatment per status. Labels themselves come from translations
// (SLOP-10) — this constant only knows about colors. Once we add
// semantic-token CSS variables (`bg-status-running`, …) the literal
// Tailwind colors will move to `:root` themes.
const STATUS_STYLE: Record<string, { dot: string; text: string }> = {
    running: { dot: "bg-emerald-500", text: "text-emerald-500" },
    starting: { dot: "bg-amber-500 animate-pulse", text: "text-amber-500" },
    stopping: { dot: "bg-amber-500 animate-pulse", text: "text-amber-500" },
    stopped: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
    failed: { dot: "bg-red-500", text: "text-red-500" },
    exited: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" }
};

const statusFor = (
    status: string,
    statusLabels: Record<string, string>
): { dot: string; text: string; label: string } => {
    const style =
        STATUS_STYLE[status] ?? {
            dot: "bg-muted-foreground/40",
            text: "text-muted-foreground"
        };
    return {
        ...style,
        // Fall back to the raw status when an unknown value comes back —
        // better to show the wire value than a missing-translation gap.
        label: statusLabels[status] ?? status
    };
};

interface StatProps {
    icon: typeof Cpu;
    label: string;
    value: ReactNode;
    sub?: ReactNode;
}

// Single stat cell rendered inside the shared overview Card; the *card* wraps
// every stat together so they sit next to each other in one outlined surface.
const Stat = ({ icon: Icon, label, value, sub }: StatProps) => (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                {label}
            </div>
            <div className="text-foreground truncate text-sm font-semibold tabular-nums">
                {value}
            </div>
            {sub && (
                <div className="text-muted-foreground text-xs">{sub}</div>
            )}
        </div>
    </div>
);

const VmDetail = () => {
    const { id } = useParams<{ id: string }>();
    const mowsContext = useMows();
    const locale = mowsContext.currentLanguage?.code;
    const [vm, setVm] = useState<VmSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());

    // Live VM data — fetch once, then re-fetch on every matching event
    // (status flip, rename, delete) instead of polling on a timer.
    useEffect(() => {
        if (!id) return;
        let alive = true;
        const refetch = async () => {
            try {
                const vmResponse = await api.v1.getVm(id);
                if (!alive) return;
                setVm(vmResponse.data);
                setError(null);
            } catch (error) {
                if (!alive) return;
                setError(await describeApiError(error));
            }
        };
        refetch();
        const unsubscribe = subscribeEvents((event) => {
            if (event.type === "resync") {
                refetch();
                return;
            }
            if (
                (event.type === "vm_updated" || event.type === "vm_deleted")
                && event.id === id
            ) {
                refetch();
            }
        });
        return () => {
            alive = false;
            unsubscribe();
        };
    }, [id]);

    // Tick a clock every second so the relative time + uptime stay fresh
    // even between data refreshes.
    useEffect(() => {
        const intervalHandle = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(intervalHandle);
    }, []);

    const commitRename = async (next: string) => {
        if (!vm) return;
        try {
            const updated = await renameVm(vm.id, next);
            setVm(updated);
            toast.success(
                mowsContext.t.supervisor.vmDetail.renamedTo.replace("{name}", next)
            );
        } catch (error) {
            toast.error(await describeApiError(error));
        }
    };

    const startedAt = useMemo(
        () => (vm ? new Date(vm.started_at) : null),
        [vm]
    );
    const endAt = useMemo(
        () => (vm?.exited_at ? new Date(vm.exited_at) : null),
        [vm]
    );
    const uptimeMs = useMemo(() => {
        if (!startedAt) return 0;
        return (endAt ?? now).getTime() - startedAt.getTime();
    }, [startedAt, endAt, now]);

    // ConsoleManager `types`: each entry's `render` is invoked once per
    // spawned terminal, so every tab gets a fresh `<VmSshConsole>` (own
    // socket, own ssh subprocess on the supervisor). Pinning `vm.id`
    // in the closure keeps the manager tied to this page's VM even if
    // the user navigates between VMs while a session is open.
    //
    // Memoise so PureComponent's prop diff bails out across re-renders
    // — recreating `types` on every poll tick would otherwise reset the
    // tab list to its initial state on every 2 s data refresh. Must sit
    // above the early returns below or the hook count changes between
    // the pre-data and post-data renders.
    const vmId = vm?.id ?? null;
    const consoleTypes = useMemo<readonly ConsoleType[]>(
        () =>
            vmId
                ? [
                      {
                          id: "ssh",
                          label: mowsContext.t.supervisor.vmDetail.console.ssh.typeLabel,
                          icon: TerminalSquare,
                          // `ctx.tabId` is a stable ConsoleManager id
                          // that survives reload via the
                          // `persistenceKey` on the manager — passing
                          // it as `sessionId` lets the supervisor
                          // back the remote process with a tmux
                          // session of the same name. A reload then
                          // reattaches instead of spawning a fresh
                          // shell.
                          render: (ctx) => (
                              <VmSshConsole vmId={vmId} sessionId={ctx.tabId} />
                          )
                      },
                      {
                          id: "claude",
                          label: mowsContext.t.supervisor.vmDetail.console.claude.typeLabel,
                          icon: Bot,
                          // Server-side bootstrap (kinds::builtin_claude)
                          // stages the host's ~/.claude from /creds and
                          // execs `claude --dangerously-skip-permissions`,
                          // so the user lands inside an authenticated
                          // session with no onboarding prompts. Same
                          // tmux-keyed sessionId pattern as `ssh` —
                          // a page reload reattaches to the running
                          // claude rather than restarting it.
                          render: (ctx) => (
                              <VmSshConsole
                                  vmId={vmId}
                                  command="claude"
                                  sessionId={ctx.tabId}
                              />
                          )
                      }
                  ]
                : [],
        [
            vmId,
            mowsContext.t.supervisor.vmDetail.console.ssh.typeLabel,
            mowsContext.t.supervisor.vmDetail.console.claude.typeLabel
        ]
    );

    if (!id) return null;

    if (error && !vm) {
        return (
            <div className="text-destructive p-10 text-sm">
                {mowsContext.t.supervisor.vmDetail.loadFailed} {error}
            </div>
        );
    }

    if (!vm) {
        return (
            <div className="text-muted-foreground p-10 text-sm">
                {mowsContext.t.supervisor.vmDetail.loading}
            </div>
        );
    }

    const status = statusFor(vm.status, mowsContext.t.supervisor.vmDetail.status);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
            {/* Single outlined card: identity on the left, stats laid out
                horizontally on the right, separated by vertical dividers. */}
            <Card>
                <CardContent className="flex flex-nowrap items-center gap-5 p-4">
                    {/* Identity */}
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Server className="text-muted-foreground size-5 shrink-0" aria-hidden />
                        <div className="min-w-0">
                            <InlineEdit
                                as="h1"
                                value={vm.name}
                                onCommit={commitRename}
                                ariaLabel="VM name"
                                // Lock the editor width so typing long names
                                // never reflows the hero row. 18rem fits a
                                // realistic VM-name range; the caret scrolls
                                // horizontally for longer values.
                                width="18rem"
                                className="text-foreground text-lg font-semibold tracking-tight"
                            />
                            <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                                <span
                                    className={`${status.dot} inline-block size-1.5 shrink-0 rounded-full`}
                                    aria-hidden
                                />
                                <span className={`${status.text} font-medium`}>
                                    {status.label}
                                </span>
                                <span aria-hidden>·</span>
                                <span className="truncate">
                                    {startedAt
                                        ? formatRelative(startedAt, now, locale)
                                        : "—"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats — fill remaining width, all on one line */}
                    <div className="flex flex-1 flex-nowrap items-center gap-6">
                        <Stat
                            icon={Cpu}
                            label={mowsContext.t.supervisor.vmDetail.stat.cpu}
                            value={
                                vm.cpus
                                    ? `${vm.cpus} ${mowsContext.t.supervisor.vmDetail.stat.vcpuSuffix}`
                                    : mowsContext.t.supervisor.vmDetail.stat.unknown
                            }
                        />
                        <Stat
                            icon={MemoryStick}
                            label={mowsContext.t.supervisor.vmDetail.stat.memory}
                            value={
                                vm.memory_mb
                                    ? formatBytes(vm.memory_mb)
                                    : mowsContext.t.supervisor.vmDetail.stat.unknown
                            }
                        />
                        <Stat
                            icon={Clock}
                            label={mowsContext.t.supervisor.vmDetail.stat.uptime}
                            value={formatDuration(uptimeMs)}
                            sub={endAt ? mowsContext.t.supervisor.vmDetail.stoppedSub : undefined}
                        />
                        <Stat
                            icon={HardDrive}
                            label={mowsContext.t.supervisor.vmDetail.stat.baseImage}
                            value={
                                <span className="capitalize">
                                    {vm.image === "nixos" ? "NixOS" : vm.image}
                                </span>
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/*
             * Console panel — VSCode-style ConsoleManager. Currently the
             * only registered type is "SSH" (direct ssh into the guest
             * via the supervisor's /v1/vms/{id}/ssh-io websocket). Each
             * new tab opens its own socket + ssh subprocess on the
             * host. Auto-seeds one SSH tab so the panel is usable the
             * moment the VM detail page loads.
             */}
            <Card className="overflow-hidden p-0">
                <div className="border-b border-border px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {mowsContext.t.supervisor.vmDetail.console.sectionTitle}
                </div>
                <div className="h-[420px] w-full">
                    <ConsoleManager
                        types={consoleTypes}
                        defaultTypeId="ssh"
                        initialTabs={[{ typeId: "ssh" }]}
                        // Persist the per-VM tab + split layout to
                        // localStorage so a reload doesn't wipe the
                        // user's set of open consoles. The vm.id is
                        // the natural scoping key — each VM keeps its
                        // own tab arrangement, and deleting the VM
                        // discards the entry on next mount via the
                        // hydrate-then-validate path.
                        persistenceKey={`vm:${vm.id}:console`}
                    />
                </div>
            </Card>
        </div>
    );
};

export default VmDetail;
