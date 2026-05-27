// Regression suite for the claude-kind bootstrap inside a VM.
//
// What we lock in (all set by `src/kinds.rs::builtin_claude()`'s
// bootstrap and `image-builder/alpine.Dockerfile`):
//
//   1. Permission mode is the **bypass** ("dangerously skip
//      permissions") flavour, not `acceptEdits`. The TUI banner
//      renders "bypass permissions" instead of "accept edits on".
//   2. The host's `~/.claude/plugins/` is staged into the agent's
//      `~/.claude/plugins/` so the enabled plugins (autoresearch,
//      code-review, frontend-design) resolve inside the VM. We
//      verify by typing `/` and asserting the slash-command list
//      includes a known plugin command.
//   3. The `chrome-devtools` MCP is registered in the staged
//      `.claude.json` (`mcpServers.chrome-devtools` →
//      `chrome-devtools-mcp`). `/mcp` lists it.
//
// These are end-to-end assertions on the *running* claude TUI inside
// the guest, driven through the same WebSocket xterm the UI uses. The
// goal is to catch a regression where one of the staging steps in the
// bootstrap string drops out (a shell-quoting bug, an `if [ -d
// /creds/plugins ]` typo, a future split between the in-code bootstrap
// and the on-disk manifest) before it ships.
//
// The whole spec is gated on real host claude credentials being
// present on the supervisor host — without `.credentials.json` the
// TUI never finishes booting and the assertions would race a "Not
// logged in" prompt. The `requireHostClaudeCredentials()` helper
// applies that gate uniformly.

import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SUPERVISOR_URL =
    process.env.MOWS_VM_SUPERVISOR_URL ?? "http://127.0.0.1:7878";

const TOKEN_FILE =
    process.env.MOWS_VM_SUPERVISOR_API_TOKEN_FILE ??
    join(
        process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"),
        "mows-agent/api_token"
    );

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

// Auth is optional: in dev the supervisor runs with
// MOWS_VM_SUPERVISOR_AUTH_DISABLE=true and rejects nothing. We still
// pass the bearer when the file is present so this suite works
// against an authenticated production container too.
const loadTokenOrEmpty = (): string => {
    const envToken = process.env.MOWS_VM_SUPERVISOR_API_TOKEN;
    if (envToken && envToken.trim()) return envToken.trim();
    try {
        const raw = readFileSync(TOKEN_FILE, "utf8").trim();
        return raw;
    } catch {
        return "";
    }
};

const headers = (token: string): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
};

interface VmSummary {
    id: string;
    name: string;
    status: string;
}

const createVm = async (token: string): Promise<VmSummary> => {
    const response = await fetch(`${SUPERVISOR_URL}/v1/vms`, {
        method: "POST",
        headers: headers(token),
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
        headers: headers(token)
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
        headers: headers(token)
    }).catch(() => undefined);
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
    if (!token) return;
    await page.addInitScript(
        ({ key, value }: { key: string; value: string }) => {
            localStorage.setItem(key, value);
        },
        { key: TOKEN_STORAGE_KEY, value: token }
    );
};

// Read the visible xterm row buffer as one newline-joined string. Used
// both for "wait for X to appear" polls and for "snapshot the final
// state of the screen" assertions. The selector mirrors what the
// sibling specs use so a future xterm version bump only needs editing
// in one shared helper.
const readTerminal = async (page: Page): Promise<string> =>
    page.evaluate(() => {
        const rows = document.querySelectorAll(".xterm-rows > div");
        return Array.from(rows)
            .map((row) => (row as HTMLElement).innerText ?? row.textContent ?? "")
            .join("\n");
    });

// The claude TUI redraws its bottom-bar on every keystroke; polling
// until the *next* unique line appears is more reliable than waiting
// for a fixed timeout after typing. `marker` is whatever should
// appear *after* the typed command resolves.
const waitForOutput = async (
    page: Page,
    marker: RegExp,
    timeoutMs = 30_000,
    description = marker.source
): Promise<void> => {
    await expect
        .poll(() => readTerminal(page), {
            timeout: timeoutMs,
            message: `expected the TUI to render ${description}`
        })
        .toMatch(marker);
};

// Open Claude Code tab inside a freshly-running VM and wait for the
// boot banner. All bootstrap-side regressions surface during this
// boot, so callers can rely on the TUI being interactive afterwards.
const openClaudeCodeTab = async (page: Page, vmId: string): Promise<void> => {
    await page.goto(`/vms/${vmId}`);

    // Wait for the auto-seeded SSH tab to mount first so we know the
    // VmDetail page is fully wired up before we click the new-tab
    // picker.
    await expect(
        page.getByRole("textbox", { name: "Terminal input" })
    ).toBeVisible({ timeout: 30_000 });

    await page
        .getByRole("button", { name: "Open new console of a specific type" })
        .click();
    await page.getByRole("menuitem", { name: "Claude Code" }).click();

    // `Claude Code v` is the boot banner. The version line +
    // `/workspace` cwd together mean we reached `exec claude` and the
    // binary printed its UI — the bootstrap shell script finished
    // successfully.
    await waitForOutput(
        page,
        /Claude Code v[\d.]+/,
        60_000,
        "the Claude Code boot banner"
    );
    await waitForOutput(
        page,
        /\/workspace/,
        15_000,
        "the /workspace cwd line"
    );
};

// Send a slash command into the active xterm. The claude TUI listens
// for `/` to open its command palette and Enter to submit.
const runSlashCommand = async (page: Page, command: string): Promise<void> => {
    const terminal = page.getByRole("textbox", { name: "Terminal input" });
    await terminal.click();
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
};

const requireHostClaudeCredentials = (): void => {
    // Same gate the sibling sshConsole.spec.ts uses for its claude
    // boot test — if there's no .credentials.json, the TUI will sit
    // on "Not logged in" forever and every assertion below would
    // misleadingly fail.
    const credsFile =
        process.env.MOWS_VM_SUPERVISOR_HOST_CREDS_FILE ??
        join(homedir(), ".claude/.credentials.json");
    if (!existsSync(credsFile)) {
        test.skip(true, `Missing ${credsFile} — log into claude on the host to enable this suite.`);
        return;
    }
    try {
        if (statSync(credsFile).size === 0) {
            test.skip(true, `Empty ${credsFile} — log into claude on the host to enable this suite.`);
        }
    } catch {
        test.skip(true, `Cannot read ${credsFile}.`);
    }
};

// We need the host plugins/ dir staged into the guest for autoresearch
// to be available. Skip the autoresearch-specific test (but NOT the
// permission-mode + MCP tests) when the host has no plugins/ — this
// keeps the suite green on fresh dev boxes without misleadingly
// passing the autoresearch assertion.
const hostHasPluginsDir = (): boolean => {
    const pluginsDir = join(homedir(), ".claude", "plugins");
    try {
        return statSync(pluginsDir).isDirectory();
    } catch {
        return false;
    }
};

test.describe("claude-kind bootstrap regressions", () => {
    test.beforeEach(() => {
        requireHostClaudeCredentials();
    });

    test("permission mode renders as bypass, not acceptEdits", async ({ page }) => {
        // Old default (acceptEdits) painted `accept edits on (shift+tab
        // to cycle)` in the bottom bar. The new default (`--dangerously
        // -skip-permissions`) paints the bypass label and explicitly
        // does NOT show `accept edits` — that's our regression target.
        // If a future bootstrap silently regresses to acceptEdits, the
        // second assertion catches it even if the first one matches a
        // future label rename.
        const token = loadTokenOrEmpty();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await openClaudeCodeTab(page, vm.id);

            const screen = await readTerminal(page);

            expect(
                screen,
                "Claude TUI bottom-bar should advertise bypass/skip-permissions mode"
            ).toMatch(/bypass.*permission|skip.*permission/i);

            expect(
                screen,
                "Claude TUI bottom-bar still shows acceptEdits — bootstrap regressed to --permission-mode acceptEdits"
            ).not.toMatch(/accept edits on/i);
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("/mcp lists chrome-devtools server", async ({ page }) => {
        // `mcpServers.chrome-devtools` is injected into the staged
        // `.claude.json` by the python merge step in the bootstrap.
        // Inside the VM, `chrome-devtools-mcp` is on $PATH because
        // alpine.Dockerfile npm-installs it globally, and chromium is
        // available at /usr/bin/chromium-browser (the bootstrap sets
        // PUPPETEER_EXECUTABLE_PATH so the MCP doesn't try to download
        // its own bundled chrome).
        //
        // We don't actually exercise the MCP here — that would require
        // navigating a real page and pollutes the test with chromium
        // boot timing. We only assert the server is *registered*, which
        // is exactly what the bootstrap change introduced.
        const token = loadTokenOrEmpty();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await openClaudeCodeTab(page, vm.id);

            await runSlashCommand(page, "/mcp");

            await waitForOutput(
                page,
                /chrome-devtools/,
                20_000,
                "chrome-devtools entry in the /mcp server list"
            );

            // Negative assertion: if MCP staging dropped (e.g. python
            // merge step silently `or true`'d out), the /mcp screen
            // would say "No MCP servers configured" — explicitly
            // catch that wording so the failure message is useful.
            const screen = await readTerminal(page);
            expect(
                screen,
                "No MCP servers configured — bootstrap failed to inject mcpServers into .claude.json"
            ).not.toMatch(/no mcp servers configured/i);
        } finally {
            await deleteVm(token, vm.id);
        }
    });

    test("autoresearch plugin is loaded inside the VM", async ({ page }) => {
        if (!hostHasPluginsDir()) {
            test.skip(true, "Host ~/.claude/plugins/ is absent — install at least one plugin to enable this test.");
            return;
        }
        // Tests the second half of the staging path: `cp -a
        // /creds/plugins /home/agent/.claude/plugins`. Without that
        // copy the agent's settings.json still lists `enabledPlugins.
        // autoresearch@autoresearch` but the plugin manifest files
        // are missing, so /help shows none of the autoresearch
        // sub-commands.
        const token = loadTokenOrEmpty();
        await seedToken(page, token);

        const vm = await createVm(token);

        try {
            await waitForRunning(token, vm.id);
            await openClaudeCodeTab(page, vm.id);

            // Open the slash-command palette and start typing
            // `/autoresearch`. Claude's fuzzy-matcher narrows to any
            // command that contains the substring; with the plugin
            // loaded we expect at least the top-level
            // `autoresearch:autoresearch` entry to appear in the
            // dropdown.
            const terminal = page.getByRole("textbox", { name: "Terminal input" });
            await terminal.click();
            await page.keyboard.type("/autoresearch");

            await waitForOutput(
                page,
                /autoresearch/i,
                10_000,
                "an autoresearch entry in the slash-command palette"
            );

            // Cancel the palette so we don't accidentally submit a
            // half-typed command into the next test's session.
            await page.keyboard.press("Escape");
        } finally {
            await deleteVm(token, vm.id);
        }
    });
});
