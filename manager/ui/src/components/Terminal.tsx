import { CSSProperties, Component, createRef } from "react";
import { IDisposable, ITerminalAddon, Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

interface TerminalComponentProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly url: string;
}

interface TerminalComponentState {}

export default class TerminalComponent extends Component<
    TerminalComponentProps,
    TerminalComponentState
> {
    private terminalRef = createRef<HTMLDivElement>();
    private terminal: Terminal | null = null;
    private statusBanner = createRef<HTMLDivElement>();

    componentDidMount() {
        if (this.terminalRef.current && this.statusBanner.current) {
            this.terminal = new Terminal({ cursorBlink: true });

            this.terminal.loadAddon(new WebSocketAddon(this.props.url, this.statusBanner.current));
            this.terminal.open(this.terminalRef.current);
        }
    }

    componentWillUnmount() {
        if (this.terminal) {
            this.terminal.dispose();
        }
    }

    render() {
        return (
            <div
                style={{ ...this.props.style }}
                className={`VNC w-full h-full ${this.props.className ?? ""}`}
            >
                <div ref={this.statusBanner}></div>
                <div ref={this.terminalRef} className="w-full h-full"></div>
            </div>
        );
    }
}

const DELIMITER = ";";
const START_PREFIX = "0";
const INPUT_PREFIX = "1";
const RESIZE_PREFIX = "2";

export class WebSocketAddon implements ITerminalAddon {
    private _socket?: WebSocket;
    //@ts-ignore
    private _terminal: Terminal;
    private _reconnect: number = -1;
    private _status: StatusBanner;
    private _disposables: IDisposable[] = [];
    private endpoint: string;

    constructor(path: string, statusBanner: HTMLElement) {
        this._status = new StatusBanner(statusBanner);
        this.endpoint = path;
    }

    createSocket = (endpoint: string) => {
        const socket = new WebSocket(endpoint);
        socket.binaryType = "arraybuffer";

        return socket;
    };

    public activate(terminal: Terminal): void {
        terminal.clear();
        terminal.focus();

        this._status.setConnecting();
        this._socket = this.createSocket(this.endpoint);
        this._terminal = terminal;

        this._disposables = [];
        this._disposables.push(addSocketListener(this._socket, "open", () => this._onOpen()));
        this._disposables.push(
            addSocketListener(this._socket, "message", ev => this._onMessage(ev))
        );
        this._disposables.push(addSocketListener(this._socket, "close", e => this._dispose(e)));
        this._disposables.push(terminal.onData(data => this._sendData(data)));
        this._disposables.push(terminal.onBinary(data => this._sendBinary(data)));
        this._disposables.push(terminal.onResize(() => this._sendResize()));
        this._disposables.push(addWindowListener("resize", () => this._sendResize()));

        this._sendResize();
    }

    public dispose(): void {
        this._dispose(undefined);
    }

    private _dispose(closeEvent?: CloseEvent): void {
        this._status.setDisconnected(closeEvent?.reason, this._reconnect);
        this._terminal.blur();
        for (const d of this._disposables) {
            d.dispose();
        }

        if (this._reconnect >= 0) {
            const timeout = setTimeout(() => {
                this._reconnect = -1;
                this.activate(this._terminal);
            }, this._reconnect * 1000);

            this._disposables.push({ dispose: () => clearTimeout(timeout) });
        }
    }

    private _onOpen(): void {
        if (!this._checkOpenSocket()) {
            setTimeout(() => this._onOpen(), 1000);
            return;
        }

        this._status.setConnected();
        this._socket!.send(
            `${START_PREFIX}${DELIMITER}${Math.round(this._terminal.rows)}${DELIMITER}${Math.round(
                this._terminal.cols
            )}`
        );
    }

    private _onMessage(ev: MessageEvent): void {
        const data: ArrayBuffer | string = ev.data;

        this._terminal.write(typeof data === "string" ? data : new Uint8Array(data));
    }

    private _sendData(data: string): void {
        if (!this._checkOpenSocket()) {
            return;
        }

        this._socket!.send(`${INPUT_PREFIX}${DELIMITER}${data}`);
    }

    private _sendResize(): void {
        if (!this._checkOpenSocket()) {
            return;
        }

        this._socket!.send(
            `${RESIZE_PREFIX}${DELIMITER}${Math.round(this._terminal.rows)}${DELIMITER}${Math.round(
                this._terminal.cols
            )}`
        );
    }

    private _sendBinary(data: string): void {
        if (!this._checkOpenSocket()) {
            return;
        }
        const buffer = new Uint8Array(data.length + 2);
        buffer[0] = INPUT_PREFIX.charCodeAt(0);
        buffer[1] = DELIMITER.charCodeAt(0);
        for (let i = 0; i < data.length; ++i) {
            buffer[i + 2] = data.charCodeAt(i) & 255;
        }
        this._socket!.send(buffer);
    }

    private _checkOpenSocket(): boolean {
        if (this._socket!.readyState === WebSocket.OPEN) {
            return true;
        }

        //console.warn(`Socket state is: ${this._socket!.readyState}`);
        return false;
        ``;
    }
}

function addSocketListener<K extends keyof WebSocketEventMap>(
    socket: WebSocket,
    type: K,
    handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any
): IDisposable {
    socket.addEventListener(type, handler);
    let disposed = false;
    return {
        dispose: () => {
            if (!handler || disposed) {
                // Already disposed
                return;
            }

            disposed = true;
            socket.removeEventListener(type, handler);
        }
    };
}

function addWindowListener<K extends keyof WindowEventMap>(
    type: K,
    handler: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
): IDisposable {
    window.addEventListener(type, handler, options);
    let disposed = false;
    return {
        dispose: () => {
            if (!handler || disposed) {
                // Already disposed
                return;
            }

            disposed = true;
            window.removeEventListener(type, handler);
        }
    };
}

enum Status {
    CONNECTING,
    CONNECTED,
    DISCONNECTED
}

const STATUS_CLASSES: Record<Status, string> = {
    [Status.CONNECTING]: "connecting",
    [Status.CONNECTED]: "connected",
    [Status.DISCONNECTED]: "disconnected"
};

export class StatusBanner {
    private _el: HTMLElement;
    private _textInterval?: number;

    constructor(el: HTMLElement) {
        this._el = el;
    }

    setConnecting() {
        this._clearTextInterval();
        this._setText("Connecting...");
        this._setStatus(Status.CONNECTING);
    }

    setConnected() {
        this._clearTextInterval();
        this._setText("Connected");
        this._setStatus(Status.CONNECTED);
    }

    setDisconnected(reason?: string, reconnect?: number) {
        this._clearTextInterval();
        let text = "Disconnected";
        if (reason !== null && reason !== "") {
            text += ` - ${reason}`;
        }

        this._setText(text);
        this._setStatus(Status.DISCONNECTED);

        if (reconnect != null && reconnect >= 0) {
            let counter = 0;
            const textUpdater = () => {
                const seconds = reconnect - counter;
                counter += 1;
                if (seconds == 0) {
                    this._clearTextInterval();
                    return;
                }

                this._setText(text + ` (reconnecting in ${seconds}s)`);
            };
            //@ts-ignore
            this._textInterval = setInterval(textUpdater, 1000);
            textUpdater();
        }
    }

    private _setText(text: string) {
        if (!this._el) return;
        this._el.textContent = text;
    }

    private _setStatus(status: Status) {
        if (!this._el) return;
        this._el.className = STATUS_CLASSES[status];
    }

    private _clearTextInterval() {
        if (this._textInterval != null) {
            clearInterval(this._textInterval);
            this._textInterval = undefined;
        }
    }
}
