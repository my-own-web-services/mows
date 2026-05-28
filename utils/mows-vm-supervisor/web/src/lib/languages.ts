// Per-app language registry. The @my-own-web-services/react-components base translation is
// imported and extended with supervisor-specific keys (declared in
// `./translations.ts`).

import type { Language, Translation } from "@my-own-web-services/react-components/lib/languages";
import baseEn from "@my-own-web-services/react-components/lib/languages/en-US/default";
import "./translations"; // module augmentation side-effect

const enUS: Translation = {
    ...baseEn,
    actions: {
        ...baseEn.actions,
        "supervisor.vm.stop": "Stop VM",
        "supervisor.vm.rename": "Rename VM",
        "supervisor.vm.delete": "Delete VM",
        "supervisor.agent.stop": "Stop agent",
        "supervisor.agent.rename": "Rename agent",
        "supervisor.agent.delete": "Delete agent"
    },
    supervisor: {
        sidebar: {
            vms: {
                title: "VMs",
                empty: "No VMs yet.",
                loading: "Loading VMs…",
                newVm: "New VM"
            },
            agents: {
                title: "Agents",
                empty: "No agents yet.",
                loading: "Loading agents…"
            },
            error: "Failed to load"
        },
        vmDetail: {
            status: {
                running: "running",
                starting: "starting",
                stopping: "stopping",
                stopped: "stopped",
                failed: "failed",
                exited: "exited"
            },
            renamedTo: "renamed to {name}",
            stoppedSub: "stopped",
            loadFailed: "Failed to load VM:",
            loading: "Loading…",
            stat: {
                cpu: "CPU",
                vcpuSuffix: "vCPU",
                memory: "Memory",
                uptime: "Uptime",
                baseImage: "Base image",
                unknown: "—"
            },
            console: {
                sectionTitle: "Console",
                ssh: {
                    typeLabel: "SSH",
                    connecting: "Connecting…",
                    connected: "Connected",
                    disconnected: "Disconnected",
                    error: "Connection error"
                },
                claude: {
                    typeLabel: "Claude Code"
                }
            }
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
