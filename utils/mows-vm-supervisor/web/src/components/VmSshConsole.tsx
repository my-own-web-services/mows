// VmSshConsole — pipes a websocket-tunnelled ssh session into the VM
// through an <xterm> Terminal. One instance per session: the
// ConsoleManager re-renders it for every spawned terminal so each tab
// owns its own socket + ssh process on the supervisor.
//
// Wire shape (matches GET /v1/vms/{id}/ssh-io on the supervisor):
//   • Outgoing frames: binary keystrokes / pastes.
//   • Incoming frames: binary bytes from the remote sshd → xterm.
//   • Initial cols/rows are passed via ?cols=N&rows=N query so the
//     remote PTY's first `stty` matches the on-screen grid. Resize is
//     not piped live (the supervisor doesn't allocate a host-side PTY
//     around the ssh client) — closing the tab and reopening with a
//     new size is the workaround.

import Terminal, {
    type TerminalHandle
} from "@mows/react-components/components/console/terminal/Terminal";
import { useMows } from "@mows/react-components/lib/mowsContext/MowsContext";
import { PureComponent, createRef, type ReactNode } from "react";

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

/** Which remote command the supervisor execs after the ssh handshake.
 *  `"shell"` → interactive login shell.
 *  `"claude"` → bootstrap that stages host credentials and execs
 *  `claude --dangerously-skip-permissions`. Matches the
 *  `?command=` values accepted by `/v1/vms/{id}/ssh-io`. */
export type VmSshCommand = "shell" | "claude";

interface VmSshConsoleProps {
    readonly vmId: string;
    readonly command?: VmSshCommand;
    /** Stable session id. The supervisor wraps the remote process in
     *  a tmux session named `mows-<sessionId>`, so reloading the page
     *  reattaches to the same shell/claude process instead of spawning
     *  a fresh one. Comes from `ConsoleManager`'s `tabId` so it
     *  persists alongside the tab layout. */
    readonly sessionId?: string;
    readonly initialCols?: number;
    readonly initialRows?: number;
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

class VmSshConsoleInner extends PureComponent<VmSshConsoleProps, State> {
    state: State = { conn: "connecting", statusDetail: null };

    private socket: WebSocket | null = null;
    private terminalRef = createRef<TerminalHandle>();
    // Buffer bytes that arrive before the lazy xterm chunk has mounted.
    // `onReady` flushes this once the handle is available so consumers
    // don't lose the first banner / motd.
    private pendingWrites: Uint8Array[] = [];
    private socketOpened = false;
    // Captured by `handleReady` so `openSocket` can ask xterm for its
    // post-fit cols/rows instead of guessing. The supervisor's ssh-io
    // proxy doesn't pipe SIGWINCH, so the *initial* size we send is
    // the size the guest pty stays at for the whole session — passing
    // a too-small grid makes claude's positioned TUI overlap because
    // it lays out for a width the visible terminal doesn't actually
    // have. See the doc comment at the top of the file.
    private measuredCols: number | null = null;
    private measuredRows: number | null = null;

    componentDidMount = () => {
        // Defer the websocket open until xterm reports its post-fit
        // cols/rows via `handleReady`. If `<Terminal>`'s lazy chunk
        // never finishes (network failure, suspense fallback stuck)
        // we still need to surface a real error, so fall back to the
        // prop-supplied initial size after a short grace period.
        setTimeout(() => {
            if (!this.socketOpened) this.openSocket();
        }, 1500);
    };

    componentWillUnmount = () => {
        this.closeSocket();
    };

    private openSocket = () => {
        if (this.socketOpened) return;
        this.socketOpened = true;
        const cols = this.measuredCols ?? this.props.initialCols ?? 80;
        const rows = this.measuredRows ?? this.props.initialRows ?? 24;
        // Same-origin upgrade. `WebSocket` doesn't accept custom headers,
        // so the Authorization bearer is sent as a `?token=` query —
        // `auth_middleware.rs` accepts that fallback specifically for
        // browser WS clients.
        const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const command = this.props.command ?? "shell";
        const sessionParam = this.props.sessionId
            ? `&sessionId=${encodeURIComponent(this.props.sessionId)}`
            : "";
        const url =
            `${wsProtocol}://${window.location.host}` +
            `/v1/vms/${encodeURIComponent(this.props.vmId)}/ssh-io` +
            `?cols=${cols}&rows=${rows}&command=${command}` +
            sessionParam +
            (token ? `&token=${encodeURIComponent(token)}` : "");
        const socket = new WebSocket(url);
        socket.binaryType = "arraybuffer";
        this.socket = socket;
        socket.onopen = () => {
            this.setState({ conn: "connected", statusDetail: null });
        };
        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const bytes = new Uint8Array(event.data);
                this.writeToTerminal(bytes);
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
            // 1000 / 1005 are clean closes; anything else is worth
            // surfacing as an error pill so the operator can read the
            // status code without opening devtools.
            const clean =
                event.code === 1000 || event.code === 1005 || event.code === 1001;
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
        // Send as binary so the remote PTY sees the exact byte stream
        // (avoids surrogate-pair / UTF-8 ambiguity over text frames).
        const bytes = new TextEncoder().encode(data);
        socket.send(bytes);
    };

    private handleReady = (handle: TerminalHandle) => {
        const pending = this.pendingWrites;
        this.pendingWrites = [];
        for (const chunk of pending) handle.write(chunk);
        // Refit once the consumer's CSS has settled. xterm fires
        // `onResize` post-fit; `handleResize` captures the cols/rows
        // there and opens the websocket with the real numbers.
        try {
            handle.fit();
        } catch {
            // ignore — container not yet measurable
        }
    };

    private handleResize = (cols: number, rows: number) => {
        this.measuredCols = cols;
        this.measuredRows = rows;
        if (!this.socketOpened) this.openSocket();
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
                : conn === "disconnected"
                  ? "bg-muted text-muted-foreground border-border"
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
                    onResize={this.handleResize}
                />
            </div>
        );
    };
}

interface VmSshConsoleWrapperProps {
    readonly vmId: string;
    readonly command?: VmSshCommand;
    /** Stable session id forwarded to the supervisor via `?sessionId=` so
     *  the remote tmux session is named after the consumer's tab; reloads
     *  reattach instead of spawning a fresh shell. Comes from
     *  ConsoleManager's `tabId` (persisted alongside the tab layout). */
    readonly sessionId?: string;
    readonly initialCols?: number;
    readonly initialRows?: number;
}

/**
 * Public-facing wrapper. Pulls SSH status translations off the supervisor
 * `Translation` extension so the inner class can stay context-free
 * (PureComponent + props beats a contextType subscription here).
 */
const VmSshConsole = (props: VmSshConsoleWrapperProps): ReactNode => {
    const mowsContext = useMows();
    const ssh = mowsContext.t.supervisor.vmDetail.console.ssh;
    return (
        <VmSshConsoleInner
            vmId={props.vmId}
            command={props.command}
            sessionId={props.sessionId}
            initialCols={props.initialCols}
            initialRows={props.initialRows}
            t={{
                connecting: ssh.connecting,
                connected: ssh.connected,
                disconnected: ssh.disconnected,
                error: ssh.error
            }}
        />
    );
};

export default VmSshConsole;
