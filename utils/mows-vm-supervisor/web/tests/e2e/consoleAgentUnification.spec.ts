// e2e regression for the ConsoleManager ↔ /v1/agents unification.
//
// Background: before the refactor, ConsoleManager tabs were spawned over
// a separate `/v1/vms/{id}/ssh-io` websocket and lived in the in-memory
// `ssh_sessions` registry. After the refactor, every tab idempotently
// PUTs `/v1/vms/{vmId}/agents/{tabId}` — which materialises the tab as
// a real Agent row in the supervisor's DB — and then attaches I/O over
// `/v1/agents/{tabId}/io`. The two parallel runtimes are now one. This
// suite locks in the wire contract so a regression doesn't silently
// resurrect the two-runtime split.
//
// What we cover:
//   1. Auto-seeded SSH tab → exactly one kind=shell agent appears.
//   2. The tabId stored by ConsoleManager (`mows:console:vm:<id>:console`
//      → `tabs[*].id`) matches the agent id on the wire — proves the
//      frontend uses the ConsoleManager tabId as the agent id.
//   3. The sidebar's Agents list contains a row tagged
//      `data-action-target-id=<agentId>` for the new agent.
//   4. A page reload with the persisted tab is a no-op: the same tabId
//      survives via `persistenceKey`, the PUT returns the existing
//      agent, and `listAgents` still reports exactly one entry.
//   5. Opening the "Claude Code" tab adds a second agent with
//      kind=claude.
//   6. Deleting an agent via REST (the same path the sidebar
//      right-click action uses) closes the matching WebSocket and the
//      consoleManager tab's status pill stops claiming "Connected".

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOKEN_FILE =
    process.env.MOWS_VM_SUPERVISOR_API_TOKEN_FILE ??
    join(
        process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"),
        "mows-agent/api_token"
    );

const SUPERVISOR_URL =
    process.env.MOWS_VM_SUPERVISOR_URL ?? "http://127.0.0.1:7878";

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

const loadToken = (): string => {
    const token =
        process.env.MOWS_VM_SUPERVISOR_API_TOKEN ??
        readFileSync(TOKEN_FILE, "utf8");
    const trimmed = token.trim();
    if (!trimmed) {
        throw new Error(
            `Empty supervisor API token. Either set MOWS_VM_SUPERVISOR_API_TOKEN ` +
                `or write the token to ${TOKEN_FILE}.`
        );
    }
    return trimmed;
};

interface VmSummary {
    id: string;
    name: string;
    status: string;
}

interface AgentSummary {
    id: string;
    vm_id: string;
    name: string;
    kind: string;
    status: string;
    started_at: string;
    exited_at?: string | null;
    exit_code?: number | null;
}

const authHeaders = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
});

const createVm = async (token: string): Promise<VmSummary> => {
    const response = await fetch(`${SUPERVISOR_URL}/v1/vms`, {
        method: "POST",
        headers: authHeaders(token),
        body: "{}"
    });
    if (!response.ok) {
        throw new Error(
            `POST /v1/vms failed: ${response.status} ${await response.text()}`
        );
    }
    return (await response.json()) as VmSummary;
};

const getVm = async (token: string, id: string): Promise<VmSummary> => {
    const response = await fetch(`${SUPERVISOR_URL}/v1/vms/${id}`, {
        headers: authHeaders(token)
    });
    if (!response.ok) {
        throw new Error(
            `GET /v1/vms/${id} failed: ${response.status} ${await response.text()}`
        );
    }
    return (await response.json()) as VmSummary;
};

const deleteVm = async (token: string, id: string): Promise<void> => {
    await fetch(`${SUPERVISOR_URL}/v1/vms/${id}`, {
        method: "DELETE",
        headers: authHeaders(token)
    }).catch(() => undefined);
};

const listAgentsForVm = async (
    token: string,
    vmId: string
): Promise<AgentSummary[]> => {
    const response = await fetch(`${SUPERVISOR_URL}/v1/vms/${vmId}/agents`, {
        headers: authHeaders(token)
    });
    if (!response.ok) {
        throw new Error(
            `GET /v1/vms/${vmId}/agents failed: ${response.status} ${await response.text()}`
        );
    }
    return (await response.json()) as AgentSummary[];
};

const deleteAgent = async (token: string, id: string): Promise<void> => {
    const response = await fetch(`${SUPERVISOR_URL}/v1/agents/${id}`, {
        method: "DELETE",
        headers: authHeaders(token)
    });
    if (!response.ok) {
        throw new Error(
            `DELETE /v1/agents/${id} failed: ${response.status} ${await response.text()}`
        );
    }
};

const waitForRunning = async (token: string, id: string): Promise<void> => {
    const deadline = Date.now() + 90_000;
    let last: VmSummary | null = null;
    while (Date.now() < deadline) {
        last = await getVm(token, id);
        if (last.status === "running") return;
        if (last.status === "failed" || last.status === "exited") {
            throw new Error(
                `VM ${id} reached terminal status ${last.status} before becoming reachable.`
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error(
        `VM ${id} did not reach status=running within 90s (last status: ${last?.status ?? "unknown"})`
    );
};

const seedToken = async (page: Page, token: string): Promise<void> => {
    await page.addInitScript(
        ({ key, value }: { key: string; value: string }) => {
            localStorage.setItem(key, value);
        },
        { key: TOKEN_STORAGE_KEY, value: token }
    );
};

/** Snapshot of the ConsoleManager's persisted layout for a given VM —
 *  the same JSON the component re-hydrates from on reload. We read it
 *  to discover the auto-seeded tabId without scraping the DOM. */
const readPersistedTabIds = async (
    page: Page,
    vmId: string
): Promise<string[]> => {
    return page.evaluate((vm: string) => {
        const raw = localStorage.getItem(`mows:console:vm:${vm}:console`);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as { tabs?: Record<string, unknown> };
            return Object.keys(parsed.tabs ?? {});
        } catch {
            return [];
        }
    }, vmId);
};

const waitForAgentByKind = async (
    token: string,
    vmId: string,
    kind: string,
    expectedCount: number
): Promise<AgentSummary[]> => {
    const deadline = Date.now() + 30_000;
    let last: AgentSummary[] = [];
    while (Date.now() < deadline) {
        const all = await listAgentsForVm(token, vmId);
        last = all.filter((agent) => agent.kind === kind);
        if (last.length === expectedCount) return last;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
        `Expected ${expectedCount} kind=${kind} agent(s) for vm ${vmId} within 30s, got ${last.length}: ${JSON.stringify(last)}`
    );
};

test.describe("ConsoleManager ↔ Agent unification", () => {
    test("auto-seeded SSH tab materialises as a kind=shell agent backed by the tabId", async ({
        page
    }) => {
        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await page.goto(`/vms/${vm.id}`);

            // Wait for the auto-seeded tab to PUT its agent through —
            // the inner xterm is the cheapest signal that the
            // VmAgentConsole bootstrap has run end-to-end.
            await expect(
                page.getByRole("textbox", { name: "Terminal input" })
            ).toBeVisible({ timeout: 30_000 });

            // 1. Exactly one shell agent for this VM.
            const agents = await waitForAgentByKind(token, vm.id, "shell", 1);
            const agent = agents[0];

            // 2. The tabId in ConsoleManager's persisted state IS the
            //    agent id — proves the frontend wires `ctx.tabId` →
            //    `putAgent(vmId, tabId, …)`.
            const tabIds = await readPersistedTabIds(page, vm.id);
            expect(tabIds, "ConsoleManager persisted no tabs").toHaveLength(1);
            expect(tabIds[0]).toBe(agent.id);

            // 3. Sidebar exposes the agent through its right-click
            //    contract — `data-action-target-id` is what the
            //    `GlobalContextMenu` reads to scope stop/rename/delete.
            await expect(
                page.locator(
                    `[data-actionscope="agent-row"][data-action-target-id="${agent.id}"]`
                )
            ).toBeVisible({ timeout: 10_000 });
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("PUT is idempotent — a page reload with the persisted tab does not create a second agent", async ({
        page
    }) => {
        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await page.goto(`/vms/${vm.id}`);
            await expect(
                page.getByRole("textbox", { name: "Terminal input" })
            ).toBeVisible({ timeout: 30_000 });

            const firstAgents = await waitForAgentByKind(token, vm.id, "shell", 1);
            const firstTabIds = await readPersistedTabIds(page, vm.id);
            expect(firstTabIds).toEqual([firstAgents[0].id]);

            // Reload the page. ConsoleManager re-hydrates the same
            // tabId from `mows:console:vm:<id>:console`, the
            // VmAgentConsole re-runs `putAgent(vmId, tabId, …)`, and
            // the supervisor must return the existing row rather than
            // inserting a duplicate.
            await page.reload();
            await expect(
                page.getByRole("textbox", { name: "Terminal input" })
            ).toBeVisible({ timeout: 30_000 });

            const secondTabIds = await readPersistedTabIds(page, vm.id);
            expect(secondTabIds, "tabId did not survive reload").toEqual(firstTabIds);

            // Allow a small settle window so a buggy PUT path would
            // have had time to mint a duplicate. Then assert we still
            // see exactly one shell agent.
            await page.waitForTimeout(1_000);
            const agentsAfter = await listAgentsForVm(token, vm.id);
            const shellAgents = agentsAfter.filter((a) => a.kind === "shell");
            expect(
                shellAgents,
                `reload should have been idempotent, but ${shellAgents.length} shell agents exist: ${JSON.stringify(shellAgents)}`
            ).toHaveLength(1);
            expect(shellAgents[0].id).toBe(firstAgents[0].id);
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("opening the Claude Code tab adds a second agent with kind=claude", async ({
        page
    }) => {
        // We only assert the agent row appears with the right kind —
        // not that claude actually authenticates inside the guest.
        // That deeper assertion lives in sshConsole.spec.ts and is
        // gated on host credentials; this test must pass in any
        // supervisor deployment.
        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await page.goto(`/vms/${vm.id}`);
            await expect(
                page.getByRole("textbox", { name: "Terminal input" })
            ).toBeVisible({ timeout: 30_000 });

            // Sanity: the shell tab's agent is already there.
            await waitForAgentByKind(token, vm.id, "shell", 1);

            // Open the new-tab type-picker and pick Claude Code —
            // same click-path as sshConsole.spec.ts's claude test.
            await page
                .getByRole("button", {
                    name: "Open new console of a specific type"
                })
                .click();
            await page.getByRole("menuitem", { name: "Claude Code" }).click();

            const claudeAgents = await waitForAgentByKind(token, vm.id, "claude", 1);
            const tabIds = await readPersistedTabIds(page, vm.id);
            expect(tabIds, "Claude tab not persisted").toContain(claudeAgents[0].id);
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("deleting the agent via REST flips the tab off the connected state", async ({
        page
    }) => {
        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await page.goto(`/vms/${vm.id}`);
            await expect(
                page.getByRole("textbox", { name: "Terminal input" })
            ).toBeVisible({ timeout: 30_000 });

            const agents = await waitForAgentByKind(token, vm.id, "shell", 1);
            const agent = agents[0];

            // The status pill renders only OFF the connected state
            // (connecting / disconnected / error). Wait until it's
            // gone — that's our signal the WS is up and stable.
            await expect(
                page.locator("[aria-live='polite']").filter({
                    hasText: /connecting|disconnected|error/i
                })
            ).toHaveCount(0, { timeout: 30_000 });

            await deleteAgent(token, agent.id);

            // After the agent vanishes the supervisor closes the WS;
            // the tab's status pill should re-appear with a non-clean
            // close code or an error label. Either `error` or
            // `disconnected` is acceptable — the precise code depends
            // on whether axum closes via 1000 (graceful) or 1006
            // (abnormal) in the shutdown path.
            await expect(
                page.locator("[aria-live='polite']").filter({
                    hasText: /disconnected|error/i
                })
            ).toBeVisible({ timeout: 10_000 });

            // And the agent must be gone from the API surface as well
            // (the sidebar's listAgents fetch will reflect the same).
            const remaining = await listAgentsForVm(token, vm.id);
            expect(remaining.find((a) => a.id === agent.id)).toBeUndefined();
        } finally {
            await deleteVm(token, vm.id);
        }
    });
});
