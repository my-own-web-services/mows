// Extends `@my-own-web-services/react-components`'s `Translation` interface with web-UI
// keys via TypeScript declaration merging. Every string the UI shows
// flows through `useMows().t`.

import type { Translation as MowsTranslation } from "@my-own-web-services/react-components/lib/languages";

declare module "@my-own-web-services/react-components/lib/languages" {
    interface Translation {
        supervisor: {
            sidebar: {
                vms: {
                    title: string;
                    empty: string;
                    loading: string;
                    newVm: string;
                };
                agents: {
                    title: string;
                    empty: string;
                    loading: string;
                };
                error: string;
            };
            vmDetail: {
                /** Lifecycle status pill labels (SLOP-10). */
                status: {
                    running: string;
                    starting: string;
                    stopping: string;
                    stopped: string;
                    failed: string;
                    exited: string;
                };
                /** Rename success toast — `{name}` placeholder for the new value (SLOP-11). */
                renamedTo: string;
                /** Sub-text under the "Status" pill when the VM has exited (SLOP-11). */
                stoppedSub: string;
                /** "Failed to load VM:" error prefix. */
                loadFailed: string;
                /** Generic "Loading…" placeholder. */
                loading: string;
                /** Stat-cell labels (SLOP-40). */
                stat: {
                    cpu: string;
                    /** Unit suffix when CPU count is known — e.g. `4 vCPU`. */
                    vcpuSuffix: string;
                    memory: string;
                    uptime: string;
                    baseImage: string;
                    /** Placeholder when a stat value is missing/unknown. */
                    unknown: string;
                };
                /** Console section + SSH connection status labels. */
                console: {
                    sectionTitle: string;
                    ssh: {
                        typeLabel: string;
                        connecting: string;
                        connected: string;
                        disconnected: string;
                        error: string;
                    };
                    /** Claude Code tab — runs the supervisor's claude
                     *  bootstrap so the user lands in an authenticated
                     *  session with no onboarding prompts. */
                    claude: {
                        typeLabel: string;
                    };
                };
            };
        };
    }
}

export type Translation = MowsTranslation;
