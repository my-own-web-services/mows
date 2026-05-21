import { cn } from "@/lib/utils";
import * as React from "react";

/** Imperative handle exposed by `<MachineMonitor ref={...}>`. */
export interface MachineMonitorHandle {
    connect: () => void;
    disconnect: () => void;
    sendCtrlAltDel: () => void;
    focus: () => void;
    blur: () => void;
    machineShutdown: () => void;
    machineReboot: () => void;
    machineReset: () => void;
    clipboardPaste: (text: string) => void;
    readonly connected: boolean;
}

export interface MachineMonitorProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    /** Full WebSocket URL of the VNC stream (ws:// or wss://). */
    readonly url?: string;
    /** Pre-constructed WebSocket — used instead of `url` if provided. */
    readonly websocket?: WebSocket;
    /** Disable keyboard / mouse input to the remote machine. Default: false. */
    readonly viewOnly?: boolean;
    /**
     * Passive read-only mode for embeds / thumbnails / list previews.
     *
     * In addition to `viewOnly`, this prevents the monitor from interacting
     * with the surrounding page at all: the canvas never auto-focuses on
     * mouse enter (react-vnc's default), scroll-wheel events bubble up so
     * the page can scroll, the noVNC keyboard handler does not receive
     * focus, and the dot-cursor never replaces the page cursor. Effectively
     * the monitor becomes a passive picture of the remote screen.
     *
     * Implies `viewOnly`. Default: false.
     */
    readonly readOnly?: boolean;
    /** Scale the framebuffer to fit the container. Default: true. */
    readonly scaleViewport?: boolean;
    /** Renegotiate the remote desktop size when the container resizes. */
    readonly resizeSession?: boolean;
    /** Connect immediately on mount. Default: true. */
    readonly autoConnect?: boolean;
    /** Reconnect interval after a drop in ms. Default: 3000. */
    readonly retryDuration?: number;
    /** Optional VNC password / credentials. */
    readonly password?: string;
    /** Render placeholder while the chunk loads or the connection comes up. */
    readonly loadingLabel?: string;
    readonly onConnect?: () => void;
    readonly onDisconnect?: () => void;
    readonly onSecurityFailure?: (reason?: string) => void;
}

// react-vnc + @novnc/novnc total ~250 KB. Same lazy-load pattern as Terminal
// (xterm) and CodeViewer (Monaco): consumers that import `MachineMonitor`
// from the library do not pay the cost in their initial JS bundle — the
// chunk is fetched only when a `<MachineMonitor>` first mounts.
const LazyVncMonitor = React.lazy(() => import(`./VncMonitor`));

const Fallback = ({
    className,
    style,
    label
}: {
    className?: string;
    style?: React.CSSProperties;
    label?: string;
}) => (
    <div
        className={cn(
            `MachineMonitor bg-card text-muted-foreground flex h-full w-full items-center justify-center overflow-hidden rounded-md border text-xs`,
            className
        )}
        style={style}
        aria-busy={`true`}
    >
        {label}
    </div>
);

const MachineMonitor = React.forwardRef<MachineMonitorHandle, MachineMonitorProps>(
    (props, ref) => (
        <React.Suspense
            fallback={
                <Fallback
                    className={props.className}
                    style={props.style}
                    label={props.loadingLabel}
                />
            }
        >
            {/*
             * react-vnc captures `url`, `websocket`, and `autoConnect` in
             * refs the first time the VncScreen mounts, with an empty effect
             * dep array — so changing any of these props later is a no-op.
             * We remount the inner monitor by keying it on the connection
             * identity (url or the WebSocket reference), which forces a
             * fresh connect cycle whenever the consumer changes targets.
             */}
            <LazyVncMonitor
                {...props}
                key={props.websocket ? `ws-instance` : (props.url ?? `__idle__`)}
                ref={ref}
            />
        </React.Suspense>
    )
);

MachineMonitor.displayName = `MachineMonitor`;

export default MachineMonitor;
export { MachineMonitor };
