import { Button } from "mows-components-react/components/ui/button";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import AgentPane from "../components/AgentPane";
import StatusBadge from "../components/StatusBadge";
import VmConsole from "../components/VmConsole";
import VmDisplay from "../components/VmDisplay";
import {
    createAgent,
    getVm,
    listVmAgents,
    type AgentSummary,
    type VmSummary
} from "../lib/api";
import { webUiContext } from "../lib/actions";

const VmDetail = () => {
    const { id } = useParams();
    const { t } = useMows();
    const [vm, setVm] = useState<VmSummary | null>(null);
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!id) return;
        let alive = true;
        const tick = async () => {
            try {
                const [v, a] = await Promise.all([getVm(id), listVmAgents(id)]);
                if (!alive) return;
                setVm(v);
                setAgents(a);
            } catch (e) {
                if (alive) setError(String(e));
            }
        };
        tick();
        const handle = window.setInterval(tick, 2000);
        // Expose VM context to action handlers (Ctrl-K → "Spawn claude").
        webUiContext.currentVmId = id;
        webUiContext.refresh = tick;
        return () => {
            alive = false;
            window.clearInterval(handle);
            if (webUiContext.currentVmId === id) webUiContext.currentVmId = null;
            if (webUiContext.refresh === tick) webUiContext.refresh = null;
        };
    }, [id]);

    const handleCreateAgent = async (kind: "claude" | "shell") => {
        if (!vm) return;
        setCreating(true);
        try {
            await createAgent(vm.id, { kind });
            toast.success(`spawning ${kind} in ${vm.name}`);
        } catch (e) {
            toast.error(String(e));
        } finally {
            setCreating(false);
        }
    };

    if (!id) return null;
    if (error) {
        return (
            <div className="bg-destructive/20 text-destructive-foreground mx-auto mt-6 max-w-3xl rounded-md p-4 text-sm">
                {error}
            </div>
        );
    }
    if (!vm) {
        return (
            <div className="text-muted-foreground p-6 text-sm">Loading VM…</div>
        );
    }

    const canSpawn = vm.status === "running";

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
            <div className="flex items-baseline justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{vm.name}</h1>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 font-mono text-xs">
                        <span>{vm.id}</span>
                        <StatusBadge status={vm.status} />
                    </div>
                </div>
                <div className="text-muted-foreground text-xs">
                    ssh: 127.0.0.1:{vm.host_ssh_port ?? "—"}
                </div>
            </div>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <VmDisplay vmId={vm.id} />
                <div className="h-[300px]">
                    <VmConsole vmId={vm.id} />
                </div>
            </section>

            <section>
                <header className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t.supervisor.agents.heading}</h2>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => handleCreateAgent("claude")}
                            disabled={!canSpawn || creating}
                            title={canSpawn ? undefined : t.supervisor.agents.disabledHint}
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            {t.supervisor.agents.createClaude}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateAgent("shell")}
                            disabled={!canSpawn || creating}
                            title={canSpawn ? undefined : t.supervisor.agents.disabledHint}
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            {t.supervisor.agents.createShell}
                        </Button>
                    </div>
                </header>
                {agents.length === 0 ? (
                    <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                        {t.supervisor.agents.empty}{" "}
                        {t.supervisor.agents.emptyHintCli}{" "}
                        <code className="bg-muted rounded px-1 py-0.5 font-mono">
                            mows agents create {vm.id.slice(0, 8)} --kind claude
                        </code>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {agents.map((a) => (
                            <AgentPane key={a.id} agent={a} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default VmDetail;
