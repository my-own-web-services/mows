import { Badge } from "mows-components-react/components/ui/badge";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import StatusBadge from "../components/StatusBadge";
import { listAgents, listVms, stopVm, type AgentSummary, type VmSummary } from "../lib/api";
import { webUiContext } from "../lib/actions";

const VmList = () => {
    const { t } = useMows();
    const [vms, setVms] = useState<VmSummary[] | null>(null);
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        try {
            const [v, a] = await Promise.all([listVms(), listAgents()]);
            setVms(v);
            setAgents(a);
            setError(null);
        } catch (e) {
            setError(String(e));
        }
    };

    useEffect(() => {
        refresh();
        const handle = window.setInterval(refresh, 2000);
        // Expose refresh to global actions (e.g. Ctrl-K → "Refresh").
        webUiContext.refresh = refresh;
        webUiContext.currentVmId = null;
        return () => {
            window.clearInterval(handle);
            if (webUiContext.refresh === refresh) webUiContext.refresh = null;
        };
    }, []);

    const handleStop = async (id: string) => {
        try {
            await stopVm(id);
            toast.success(`stopped ${id.slice(0, 8)}`);
            refresh();
        } catch (e) {
            toast.error(String(e));
        }
    };

    const agentsByVm = (vmId: string): AgentSummary[] =>
        agents.filter((a) => a.vm_id === vmId);

    return (
        <div className="mx-auto max-w-6xl px-6 py-6">
            <h1 className="mb-4 text-xl font-semibold">{t.supervisor.vms.heading}</h1>
            {error && (
                <div className="bg-destructive/20 text-destructive-foreground mb-4 rounded-md p-3 text-sm">
                    {error}
                </div>
            )}
            {vms === null ? (
                <div className="text-muted-foreground text-sm">Loading…</div>
            ) : vms.length === 0 ? (
                <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
                    {t.supervisor.vms.empty}{" "}
                    <code className="bg-muted rounded px-1 py-0.5 font-mono">
                        {t.supervisor.vms.emptyHint}
                    </code>
                </div>
            ) : (
                <table className="w-full border-collapse text-sm">
                    <thead className="text-muted-foreground border-border border-b text-left text-xs uppercase">
                        <tr>
                            <th className="py-2 font-medium">{t.supervisor.vms.colName}</th>
                            <th className="py-2 font-medium">{t.supervisor.vms.colStatus}</th>
                            <th className="py-2 font-medium">{t.supervisor.vms.colSsh}</th>
                            <th className="py-2 font-medium">{t.supervisor.vms.colAgents}</th>
                            <th className="py-2 font-medium">{t.supervisor.vms.colStarted}</th>
                            <th className="py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {vms.map((vm) => {
                            const myAgents = agentsByVm(vm.id);
                            return (
                                <tr
                                    key={vm.id}
                                    className="border-border hover:bg-muted/50 border-b align-top"
                                >
                                    <td className="py-2">
                                        <Link
                                            to={`/vms/${vm.id}`}
                                            className="hover:text-primary font-medium"
                                        >
                                            {vm.name}
                                        </Link>
                                        <div className="text-muted-foreground font-mono text-xs">
                                            {vm.id.slice(0, 8)}
                                        </div>
                                    </td>
                                    <td className="py-2">
                                        <StatusBadge status={vm.status} />
                                    </td>
                                    <td className="text-muted-foreground py-2 font-mono text-xs">
                                        {vm.host_ssh_port ?? "—"}
                                    </td>
                                    <td className="py-2">
                                        {myAgents.length === 0 ? (
                                            <span className="text-muted-foreground text-xs italic">
                                                {t.supervisor.vms.noAgents}
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {myAgents.map((a) => (
                                                    <Badge
                                                        key={a.id}
                                                        variant="outline"
                                                        className="gap-1.5"
                                                    >
                                                        {a.kind}
                                                        <StatusBadge status={a.status} className="text-[10px]" />
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground py-2 text-xs">
                                        {new Date(vm.started_at).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right">
                                        {vm.status !== "stopped" && (
                                            <button
                                                onClick={() => handleStop(vm.id)}
                                                className="hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
                                                title={t.supervisor.vms.stopTooltip}
                                            >
                                                <Square className="h-3 w-3" />
                                                {t.supervisor.vms.stop}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default VmList;
