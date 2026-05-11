// Typed wrappers around the supervisor's REST + websocket API.
//
// Endpoint shapes (post-refactor):
//   GET    /v1/vms                    — list VMs
//   POST   /v1/vms                    — create VM (no kind)
//   GET    /v1/vms/:id                — VM details
//   POST   /v1/vms/:id/stop
//   DELETE /v1/vms/:id
//   GET    /v1/vms/:id/display        — RFB websocket
//   GET    /v1/vms/:id/console        — serial console websocket
//   GET    /v1/vms/:vm_id/agents      — list agents in this VM
//   POST   /v1/vms/:vm_id/agents      — spawn an agent inside the VM
//   GET    /v1/agents                 — list all agents (across VMs)
//   GET    /v1/agents/:id
//   POST   /v1/agents/:id/stop
//   DELETE /v1/agents/:id
//   GET    /v1/agents/:id/io          — bidirectional pty websocket

export interface VmSummary {
    id: string;
    name: string;
    status: "starting" | "running" | "stopped" | "failed" | string;
    host_ssh_port: number | null;
    host_docker_port: number | null;
    started_at: string;
    exited_at: string | null;
    exit_code: number | null;
}

export interface AgentSummary {
    id: string;
    vm_id: string;
    name: string;
    kind: string;
    status: "starting" | "running" | "stopped" | "failed" | string;
    started_at: string;
    exited_at: string | null;
    exit_code: number | null;
}

const headers = (): HeadersInit => {
    const token = localStorage.getItem("mows-vm-supervisor:token");
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
    const r = await fetch(input, { headers: headers(), ...init });
    if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`${r.status} ${r.statusText}${body ? ` — ${body}` : ""}`);
    }
    return r.json() as Promise<T>;
};

// ---------- VMs ----------

export const listVms = (): Promise<VmSummary[]> => fetchJson("/v1/vms");
export const getVm = (id: string): Promise<VmSummary> => fetchJson(`/v1/vms/${id}`);
export const stopVm = (id: string): Promise<void> =>
    fetchJson(`/v1/vms/${id}/stop`, { method: "POST", body: "{}" });
export const deleteVm = (id: string): Promise<void> =>
    fetchJson(`/v1/vms/${id}`, { method: "DELETE" });
export const createVm = (req: { name?: string; cwd?: string; cpus?: number; memory_mb?: number }) =>
    fetchJson<VmSummary>("/v1/vms", {
        method: "POST",
        body: JSON.stringify({ ...req, detach: true })
    });

// ---------- Agents ----------

export const listAgents = (): Promise<AgentSummary[]> => fetchJson("/v1/agents");
export const listVmAgents = (vmId: string): Promise<AgentSummary[]> =>
    fetchJson(`/v1/vms/${vmId}/agents`);
export const getAgent = (id: string): Promise<AgentSummary> =>
    fetchJson(`/v1/agents/${id}`);
export const createAgent = (
    vmId: string,
    req: { kind?: string; name?: string }
): Promise<AgentSummary> =>
    fetchJson(`/v1/vms/${vmId}/agents`, { method: "POST", body: JSON.stringify(req) });
export const stopAgent = (id: string): Promise<void> =>
    fetchJson(`/v1/agents/${id}/stop`, { method: "POST", body: "{}" });
export const deleteAgent = (id: string): Promise<void> =>
    fetchJson(`/v1/agents/${id}`, { method: "DELETE" });

// ---------- WebSocket URLs ----------

const wsBase = (): string => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
};

export const displayWsUrl = (vmId: string): string =>
    `${wsBase()}/v1/vms/${vmId}/display`;
export const consoleWsUrl = (vmId: string): string =>
    `${wsBase()}/v1/vms/${vmId}/console`;
export const agentIoWsUrl = (agentId: string): string =>
    `${wsBase()}/v1/agents/${agentId}/io`;
