// Extends `mows-components-react`'s `Translation` interface with web-UI
// keys via TypeScript declaration merging. Every string the UI shows
// flows through `useMows().t` (or `this.context!.t` in class components).

import type { Translation as MowsTranslation } from "mows-components-react/lib/languages";

declare module "mows-components-react/lib/languages" {
    interface Translation {
        supervisor: {
            appName: string;
            navAllVms: string;
            connectedTo: string;
            vms: {
                heading: string;
                empty: string;
                emptyHint: string;
                colName: string;
                colStatus: string;
                colSsh: string;
                colAgents: string;
                colStarted: string;
                stop: string;
                stopTooltip: string;
                noAgents: string;
            };
            agents: {
                heading: string;
                empty: string;
                emptyHintCli: string;
                createClaude: string;
                createShell: string;
                stop: string;
                tabChat: string;
                tabTerminal: string;
                chatPlaceholder: string;
                chatWaiting: string;
                notConnected: string;
                disabledHint: string;
            };
            display: {
                connecting: string;
            };
            console: {
                attached: string;
                error: string;
                closed: string;
            };
            actions: {
                refresh: string;
                createVm: string;
                createClaude: string;
                createShell: string;
                openCli: string;
            };
        };
    }
}

// Re-export for convenience.
export type Translation = MowsTranslation;
