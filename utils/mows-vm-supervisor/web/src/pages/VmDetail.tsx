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
// Polls `/v1/vms/{id}` every 2s so live status (uptime) stays fresh without
// a page reload.

import {
    Card,
    CardContent
} from "mows-components-react/components/ui/card";
import InlineEdit from "mows-components-react/components/input/inlineEdit/InlineEdit";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import {
    Clock,
    Cpu,
    HardDrive,
    MemoryStick,
    Server
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, describeApiError, renameVm } from "../lib/api";
import {
    formatBytes,
    formatDuration,
    formatRelative
} from "../lib/format";
import type { VmSummary } from "../api/generated/api-client";

const POLL_MS = 2000;

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
    const mows = useMows();
    const locale = mows.currentLanguage?.code;
    const [vm, setVm] = useState<VmSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());

    // Live VM + agent data.
    useEffect(() => {
        if (!id) return;
        let alive = true;
        const tick = async () => {
            try {
                const vmRes = await api.v1.getVm(id);
                if (!alive) return;
                setVm(vmRes.data);
                setError(null);
            } catch (e) {
                if (!alive) return;
                setError(await describeApiError(e));
            }
        };
        tick();
        const h = window.setInterval(tick, POLL_MS);
        return () => {
            alive = false;
            window.clearInterval(h);
        };
    }, [id]);

    // Tick a clock every second so the relative time + uptime stay fresh
    // even between data polls.
    useEffect(() => {
        const h = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(h);
    }, []);

    const commitRename = async (next: string) => {
        if (!vm) return;
        try {
            const updated = await renameVm(vm.id, next);
            setVm(updated);
            toast.success(
                mows.t.supervisor.vmDetail.renamedTo.replace("{name}", next)
            );
        } catch (e) {
            toast.error(await describeApiError(e));
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

    if (!id) return null;

    if (error && !vm) {
        return (
            <div className="text-destructive p-10 text-sm">
                {mows.t.supervisor.vmDetail.loadFailed} {error}
            </div>
        );
    }

    if (!vm) {
        return (
            <div className="text-muted-foreground p-10 text-sm">
                {mows.t.supervisor.vmDetail.loading}
            </div>
        );
    }

    const status = statusFor(vm.status, mows.t.supervisor.vmDetail.status);

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
                            label={mows.t.supervisor.vmDetail.stat.cpu}
                            value={
                                vm.cpus
                                    ? `${vm.cpus} ${mows.t.supervisor.vmDetail.stat.vcpuSuffix}`
                                    : mows.t.supervisor.vmDetail.stat.unknown
                            }
                        />
                        <Stat
                            icon={MemoryStick}
                            label={mows.t.supervisor.vmDetail.stat.memory}
                            value={
                                vm.memory_mb
                                    ? formatBytes(vm.memory_mb)
                                    : mows.t.supervisor.vmDetail.stat.unknown
                            }
                        />
                        <Stat
                            icon={Clock}
                            label={mows.t.supervisor.vmDetail.stat.uptime}
                            value={formatDuration(uptimeMs)}
                            sub={endAt ? mows.t.supervisor.vmDetail.stoppedSub : undefined}
                        />
                        <Stat
                            icon={HardDrive}
                            label={mows.t.supervisor.vmDetail.stat.baseImage}
                            value={
                                <span className="capitalize">
                                    {vm.image === "nixos" ? "NixOS" : vm.image}
                                </span>
                            }
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VmDetail;
