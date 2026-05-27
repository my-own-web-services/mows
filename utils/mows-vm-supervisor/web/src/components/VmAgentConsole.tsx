// VmAgentConsole — pipes a websocket-tunnelled agent session into an
// <xterm> Terminal. ConsoleManager re-renders one of these per tab; each
// tab is backed by a real Agent row in the supervisor's DB so it also
// shows up in the sidebar's Agents list and supports stop / rename /
// delete from there.
//
// Wire shape:
//   • Mount: PUT /v1/vms/{vmId}/agents/{agentId} with { kind } — idempotent
//     create-or-attach. First call inserts the agent + spawns the tmux
//     session; subsequent calls (page reload, tab restore) return the
//     existing row.
//   • Then: open WS /v1/agents/{agentId}/io — every attach gets its own
//     fresh ssh+`tmux attach` so multi-client works without echo bouncing.
//   • Incoming frames: binary bytes from the tmux session → xterm.
//   • Outgoing frames: binary keystrokes / pastes → tmux pane stdin.

import Terminal, {
    type TerminalHandle
} from "@mows/react-components/components/console/terminal/Terminal";
import { useMows } from "@mows/react-components/lib/mowsContext/MowsContext";
import { PureComponent, createRef, type ReactNode } from "react";
import { api, describeApiError } from "../lib/api";

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

/** Agent runtime: `"shell"` is a plain `/bin/sh` session, `"claude"` boots
 *  claude-code with credentials staged from `/creds`. Mirrors the kinds
 *  accepted by `PUT /v1/vms/{vmId}/agents/{agentId}`. */
export type VmAgentKind = "shell" | "claude";

interface VmAgentConsoleProps {
    readonly vmId: string;
    /** Stable agent id — the ConsoleManager tabId. Becomes the agents
     *  table PK and the tmux session name, so a reload reattaches to the
     *  same shell / claude process instead of spawning a fresh one. */
    readonly agentId: string;
    readonly kind: VmAgentKind;
    readonly t: {
        readonly connecting: string;
        readonly connected: string;
        readonly disconnected: string;
        readonly error: string;
    };
}

type ConnState = "connecting" | "connected" | "disconnected" | "error";

interface State {
    readonly conn: ConnState;
    readonly statusDetail: string | null;
}

class VmAgentConsoleInner extends PureComponent<VmAgentConsoleProps, State> {
    state: State = { conn: "connecting", statusDetail: null };

    private socket: WebSocket | null = null;
    private terminalRef = createRef<TerminalHandle>();
    // Buffer bytes that arrive before xterm has mounted. `onReady` flushes
    // once the handle is available so the first banner / motd isn't lost.
    private pendingWrites: Uint8Array[] = [];
    private alive = true;

    componentDidMount = () => {
        void this.bootstrap();
    };

    componentWillUnmount = () => {
        this.alive = false;
        this.closeSocket();
    };

    /** Idempotent PUT then WS attach. Surfacing PUT errors here keeps the
     *  status pill informative: a 409 from a VM that isn't running, a 404
     *  if the VM was deleted from under us, etc. */
    private bootstrap = async () => {
        try {
            await api.v1.putAgent(this.props.vmId, this.props.agentId, {
                kind: this.props.kind
            });
        } catch (error) {
            if (!this.alive) return;
            this.setState({
                conn: "error",
                statusDetail: await describeApiError(error)
            });
            return;
        }
        if (!this.alive) return;
        this.openSocket();
    };

    private openSocket = () => {
        // Same-origin upgrade. `WebSocket` doesn't accept custom headers,
        // so the Authorization bearer is sent as a `?token=` query —
        // `auth_middleware.rs` accepts that fallback specifically for
        // browser WS clients.
        const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const url =
            `${wsProtocol}://${window.location.host}` +
            `/v1/agents/${encodeURIComponent(this.props.agentId)}/io` +
            (token ? `?token=${encodeURIComponent(token)}` : "");
        const socket = new WebSocket(url);
        socket.binaryType = "arraybuffer";
        this.socket = socket;
        socket.onopen = () => {
            this.setState({ conn: "connected", statusDetail: null });
        };
        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.writeToTerminal(new Uint8Array(event.data));
                return;
            }
            if (typeof event.data === "string") {
                this.writeToTerminal(new TextEncoder().encode(event.data));
            }
        };
        socket.onerror = () => {
            this.setState({ conn: "error", statusDetail: null });
        };
        socket.onclose = (event) => {
            // 1000 / 1001 / 1005 are clean closes; anything else is worth
            // surfacing as an error pill so the operator can read the
            // status code without opening devtools.
            const clean =
                event.code === 1000 || event.code === 1001 || event.code === 1005;
            this.setState({
                conn: clean ? "disconnected" : "error",
                statusDetail: clean
                    ? null
                    : `code ${event.code}${event.reason ? ` (${event.reason})` : ``}`
            });
        };
    };

    private closeSocket = () => {
        const socket = this.socket;
        this.socket = null;
        if (socket && socket.readyState <= WebSocket.OPEN) {
            try {
                socket.close();
            } catch {
                /* ignore */
            }
        }
    };

    private writeToTerminal = (bytes: Uint8Array) => {
        const handle = this.terminalRef.current;
        if (!handle) {
            this.pendingWrites.push(bytes);
            return;
        }
        handle.write(bytes);
    };

    private handleData = (data: string) => {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        // Send as binary so the remote pty sees the exact byte stream
        // (avoids surrogate-pair / UTF-8 ambiguity over text frames).
        socket.send(new TextEncoder().encode(data));
    };

    private handleReady = (handle: TerminalHandle) => {
        const pending = this.pendingWrites;
        this.pendingWrites = [];
        for (const chunk of pending) handle.write(chunk);
        try {
            handle.fit();
        } catch {
            // ignore — container not yet measurable
        }
    };

    private renderStatusPill = (): ReactNode => {
        const { conn, statusDetail } = this.state;
        if (conn === "connected") return null;
        const t = this.props.t;
        const label =
            conn === "connecting"
                ? t.connecting
                : conn === "disconnected"
                  ? t.disconnected
                  : t.error;
        const tone =
            conn === "error"
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-muted text-muted-foreground border-border";
        return (
            <div
                className={`pointer-events-none absolute top-2 left-2 z-10 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
                aria-live="polite"
            >
                {label}
                {statusDetail ? <span className="ml-1 normal-case">{statusDetail}</span> : null}
            </div>
        );
    };

    render = (): ReactNode => {
        return (
            <div className="relative h-full w-full">
                {this.renderStatusPill()}
                <Terminal
                    ref={this.terminalRef}
                    onData={this.handleData}
                    onReady={this.handleReady}
                />
            </div>
        );
    };
}

interface VmAgentConsoleWrapperProps {
    readonly vmId: string;
    readonly agentId: string;
    readonly kind: VmAgentKind;
}

/**
 * Public wrapper. Pulls SSH-status translations off the supervisor
 * `Translation` extension so the inner class stays context-free.
 */
const VmAgentConsole = (props: VmAgentConsoleWrapperProps): ReactNode => {
    const mowsContext = useMows();
    const ssh = mowsContext.t.supervisor.vmDetail.console.ssh;
    return (
        <VmAgentConsoleInner
            vmId={props.vmId}
            agentId={props.agentId}
            kind={props.kind}
            t={{
                connecting: ssh.connecting,
                connected: ssh.connected,
                disconnected: ssh.disconnected,
                error: ssh.error
            }}
        />
    );
};

export default VmAgentConsole;
