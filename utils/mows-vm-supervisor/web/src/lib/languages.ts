// Per-app language registry. The mows-components-react base translation is
// imported and spread, then web-UI-specific keys (declared in
// `./translations.ts`) are added on top. The result is what ships to
// MowsProvider via the `languages` prop.

import type { Language, Translation } from "mows-components-react/lib/languages";
import baseEn from "mows-components-react/lib/languages/en-US/default";
import "./translations"; // module augmentation side-effect

const enUS: Translation = {
    ...baseEn,
    supervisor: {
        appName: "MOWS Agents",
        navAllVms: "← all VMs",
        connectedTo: "supervisor",
        vms: {
            heading: "VMs",
            empty: "No VMs yet.",
            emptyHint: "Run `mows agents run` in a project directory to spawn one.",
            colName: "Name",
            colStatus: "Status",
            colSsh: "SSH",
            colAgents: "Agents",
            colStarted: "Started",
            stop: "stop",
            stopTooltip: "stop VM (also stops every agent inside it)",
            noAgents: "none"
        },
        agents: {
            heading: "Agents in this VM",
            empty: "No agents in this VM yet.",
            emptyHintCli: "Spawn one with the buttons above, or from the CLI:",
            createClaude: "claude",
            createShell: "shell",
            stop: "stop agent",
            tabChat: "chat",
            tabTerminal: "terminal",
            chatPlaceholder: "Message the agent…",
            chatWaiting: "Waiting for the agent to print something…",
            notConnected: "agent not connected",
            disabledHint: "vm must be running"
        },
        display: {
            connecting: "connecting to display…"
        },
        console: {
            attached: "[console attached]",
            error: "[console error]",
            closed: "[console closed]"
        },
        actions: {
            refresh: "Refresh VM and agent list",
            createVm: "Create new VM",
            createClaude: "Spawn claude agent in current VM",
            createShell: "Spawn shell agent in current VM",
            openCli: "Copy CLI invocation to clipboard"
        }
    }
};

export const languages: Language[] = [
    {
        code: "en-US",
        originalName: "English",
        englishName: "English",
        emoji: "🇺🇸",
        // The mows lib accepts a dynamic-import factory to enable code
        // splitting; we ship a single static language so it resolves immediately.
        import: () => Promise.resolve({ default: enUS })
    }
];

export const initialTranslation: Translation = enUS;
