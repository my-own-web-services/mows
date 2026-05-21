// Extends `mows-components-react`'s `Translation` interface with web-UI
// keys via TypeScript declaration merging. Every string the UI shows
// flows through `useMows().t`.

import type { Translation as MowsTranslation } from "mows-components-react/lib/languages";

declare module "mows-components-react/lib/languages" {
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
            };
        };
    }
}

export type Translation = MowsTranslation;
