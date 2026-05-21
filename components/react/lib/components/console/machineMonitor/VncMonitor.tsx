import { cn } from "@/lib/utils";
import * as React from "react";
import { VncScreen, type VncScreenHandle } from "react-vnc";
import type { MachineMonitorHandle, MachineMonitorProps } from "./MachineMonitor";

const VncMonitor = React.forwardRef<MachineMonitorHandle, MachineMonitorProps>(
    (
        {
            className,
            style,
            url,
            websocket,
            viewOnly,
            readOnly = false,
            scaleViewport = true,
            resizeSession,
            autoConnect = true,
            retryDuration = 3000,
            password,
            onConnect,
            onDisconnect,
            onSecurityFailure
        },
        forwardedRef
    ) => {
        const screenRef = React.useRef<VncScreenHandle>(null);

        React.useImperativeHandle(
            forwardedRef,
            (): MachineMonitorHandle => ({
                connect: () => screenRef.current?.connect(),
                disconnect: () => screenRef.current?.disconnect(),
                sendCtrlAltDel: () => screenRef.current?.sendCtrlAltDel(),
                focus: () => screenRef.current?.focus(),
                blur: () => screenRef.current?.blur(),
                machineShutdown: () => screenRef.current?.machineShutdown(),
                machineReboot: () => screenRef.current?.machineReboot(),
                machineReset: () => screenRef.current?.machineReset(),
                clipboardPaste: (text) =>
                    screenRef.current?.clipboardPaste(text),
                get connected() {
                    return screenRef.current?.connected ?? false;
                }
            }),
            []
        );

        const rfbOptions = React.useMemo(
            () => (password ? { credentials: { password } } : undefined),
            [password]
        );

        return (
            <div
                style={style}
                className={cn(
                    `MachineMonitor bg-card relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border`,
                    className
                )}
            >
                {/*
                 * In `readOnly` mode the inner wrapper is `pointer-events:none`
                 * so the page beneath/around the monitor keeps full control:
                 * react-vnc's own outer div uses onMouseEnter to blur the
                 * surrounding focus and grab the canvas (so noVNC can install
                 * its keyboard handler); with pointer-events disabled that
                 * handler never fires. Scroll wheel and click events also pass
                 * through. `select-none` keeps the canvas from stealing text
                 * selection on the surrounding page.
                 */}
                <div
                    className={cn(
                        `h-full w-full`,
                        readOnly && `pointer-events-none select-none`
                    )}
                >
                    <VncScreen
                        ref={screenRef}
                        url={url}
                        websocket={websocket}
                        viewOnly={readOnly ? true : viewOnly}
                        focusOnClick={readOnly ? false : undefined}
                        showDotCursor={readOnly ? false : undefined}
                        scaleViewport={scaleViewport}
                        resizeSession={resizeSession}
                        autoConnect={autoConnect}
                        retryDuration={retryDuration}
                        rfbOptions={rfbOptions}
                        background={`transparent`}
                        onConnect={onConnect}
                        onDisconnect={onDisconnect}
                        onSecurityFailure={onSecurityFailure}
                        style={{ width: `100%`, height: `100%` }}
                    />
                </div>
            </div>
        );
    }
);

VncMonitor.displayName = `VncMonitor`;

export default VncMonitor;
