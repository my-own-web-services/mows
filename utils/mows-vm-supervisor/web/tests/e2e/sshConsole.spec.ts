// e2e regression for the VM SSH console.
//
// Scope: clicking a running VM in the sidebar opens VmDetail, the
// `<VmSshConsole>` upgrades a websocket to /v1/vms/{id}/ssh-io, the
// supervisor shells into the guest, and bytes flow both ways.
//
// What we cover:
//   1. Auth: bearer token from the supervisor's `api_token` file is
//      seeded into localStorage (matching what vite.config.ts does for
//      manual dev sessions) so /v1/* requests + the ssh websocket
//      authenticate.
//   2. VM creation via REST so each run uses a fresh guest (cheap on
//      cached qcow2; protects the suite from cross-test pollution).
//   3. SSH boot: poll until the guest's sshd is ready (the supervisor
//      reports `status: running` and the VM accepts an ssh handshake).
//   4. xterm round-trip: type a known-unique command and assert the
//      guest echoes the expected substring back into the row buffer.
//   5. Cleanup: delete the VM no matter how the test exits so the
//      next run starts clean.

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Mirrors the path vite.config.ts reads. Override with
// MOWS_VM_SUPERVISOR_API_TOKEN_FILE for non-default deployments.
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
    // Best-effort: a stop+delete may race the guest's own shutdown, so
    // 404 / 409 are accepted as "already gone".
    await fetch(`${SUPERVISOR_URL}/v1/vms/${id}`, {
        method: "DELETE",
        headers: authHeaders(token)
    }).catch(() => undefined);
};

const waitForRunning = async (token: string, id: string): Promise<void> => {
    // Boot budget: alpine on a warm host is ~10-20s; allow 90s before
    // failing loudly so a transient kernel/initramfs hiccup still
    // surfaces a real error message rather than a generic timeout.
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
    // Vite seeds this from MOWS_VM_SUPERVISOR_API_TOKEN_FILE on boot;
    // tests do it explicitly so a missing/changed env var on the dev
    // server isn't a hidden source of failure.
    await page.addInitScript(
        ({ key, value }: { key: string; value: string }) => {
            localStorage.setItem(key, value);
        },
        { key: TOKEN_STORAGE_KEY, value: token }
    );
};

const readTerminal = async (page: Page): Promise<string> =>
    page.evaluate(() => {
        const rows = document.querySelectorAll(".xterm-rows > div");
        return Array.from(rows)
            .map((row) => (row as HTMLElement).innerText ?? row.textContent ?? "")
            .join("\n");
    });

test.describe("VM SSH console", () => {
    test("connects via websocket and echoes a command", async ({ page }) => {
        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);

            await page.goto(`/vms/${vm.id}`);

            // The terminal pane is the xterm helper textbox the
            // a11y tree exposes once the websocket has opened and
            // xterm has mounted its DOM.
            const terminal = page.getByRole("textbox", {
                name: "Terminal input"
            });
            await expect(terminal).toBeVisible({ timeout: 30_000 });

            // Wait for the alpine prompt to render in the rows
            // buffer before sending input — typing earlier would
            // race the ssh greeter and the typed bytes get dropped
            // by the receiving pty.
            await expect
                .poll(() => readTerminal(page), {
                    timeout: 30_000,
                    message: "shell prompt never appeared in terminal rows"
                })
                .toContain(":~#");

            // Unique marker so a leftover line from the greeting
            // can't match by accident. The shell receives both
            // `MOWS_E2E_<id>` and the echo result on its own line.
            const marker = `MOWS_E2E_${Date.now().toString(36)}`;
            await terminal.click();
            await page.keyboard.type(`echo ${marker}`);
            await page.keyboard.press("Enter");

            await expect
                .poll(() => readTerminal(page), {
                    timeout: 15_000,
                    message: `marker ${marker} never echoed back from the guest`
                })
                .toMatch(new RegExp(`^${marker}$`, "m"));
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("Claude Code tab lands in an authenticated session", async ({ page }) => {
        // Mirrors the VmDetail UI click-path: open VM detail, switch to
        // the "Claude Code" console type, expect to land directly in an
        // authenticated claude session with no trust-this-folder prompt
        // and no /login prompt. The backend's `?command=claude` path
        // execs the bootstrap from kinds::builtin_claude, which stages
        // host credentials (.claude.json + .credentials.json) and
        // pre-marks /workspace as trusted in projects.
        //
        // The test is skipped when the host has no claude credentials
        // mounted into the supervisor — there is no useful way to
        // assert "logged in" without a real OAuth file, and skipping
        // beats a misleading failure on CI runners that don't have
        // ~/.claude provisioned.
        const credsFile = process.env.MOWS_VM_SUPERVISOR_HOST_CREDS_FILE ??
            join(
                process.env.HOME ?? "",
                ".claude/.credentials.json"
            );
        try {
            const stats = readFileSync(credsFile, "utf8");
            if (!stats.trim()) {
                test.skip(true, `Empty ${credsFile} — log into claude on the host to enable this test.`);
            }
        } catch {
            test.skip(true, `Missing ${credsFile} — log into claude on the host to enable this test.`);
        }

        const token = loadToken();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);

            await page.goto(`/vms/${vm.id}`);

            // Open the type-picker menu (the small chevron beside the
            // "New SSH" button) and pick the Claude Code entry.
            await page
                .getByRole("button", {
                    name: "Open new console of a specific type"
                })
                .click();
            await page.getByRole("menuitem", { name: "Claude Code" }).click();

            // Wait for the claude TUI to render. `Claude Code v` appears
            // in the boot banner; `/workspace` is the cwd line; their
            // presence together means the bootstrap reached `exec
            // claude` and the binary printed its UI.
            await expect
                .poll(() => readTerminal(page), {
                    timeout: 60_000,
                    message: "claude TUI never rendered in the Claude Code tab"
                })
                .toMatch(/Claude Code v[\d.]+/);

            const terminalAfterBoot = await readTerminal(page);

            // The two things we explicitly need to NOT see (the user
            // asked for "no startup questions" — local settings should
            // already be available inside the VM):
            expect(terminalAfterBoot, "trust-folder prompt re-appeared in the VM").not.toMatch(
                /trust this folder/i
            );
            expect(terminalAfterBoot, "claude reported Not logged in despite host credentials").not.toMatch(
                /Not logged in/i
            );
        } finally {
            await deleteVm(token, vm.id);
        }
    });
});
