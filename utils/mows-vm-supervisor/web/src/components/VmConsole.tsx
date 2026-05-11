import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { consoleWsUrl } from "../lib/api";

interface Props {
    readonly vmId: string;
}

/**
 * Live serial console pane. The supervisor exposes the QEMU chardev unix
 * socket as a websocket; we attach an xterm.js terminal directly. Bytes
 * flow both ways: server sends boot/agent stdout as binary frames, user
 * keystrokes go back as binary frames to the guest's serial port.
 */
const VmConsole = ({ vmId }: Props) => {
    const { t } = useMows();
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            convertEol: true,
            cursorBlink: true,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            theme: { background: "#0a0a0a" }
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        fit.fit();
        const resize = () => {
            try {
                fit.fit();
            } catch {
                /* container detached */
            }
        };
        window.addEventListener("resize", resize);

        const ws = new WebSocket(consoleWsUrl(vmId));
        ws.binaryType = "arraybuffer";
        ws.onopen = () => term.writeln(`\x1b[2m${t.supervisor.console.attached}\x1b[0m`);
        ws.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(ev.data));
            } else if (typeof ev.data === "string") {
                term.write(ev.data);
            }
        };
        ws.onerror = () => term.writeln(`\r\n\x1b[31m${t.supervisor.console.error}\x1b[0m`);
        ws.onclose = () => term.writeln(`\r\n\x1b[2m${t.supervisor.console.closed}\x1b[0m`);

        const dataDisposer = term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(new TextEncoder().encode(data));
            }
        });

        return () => {
            window.removeEventListener("resize", resize);
            dataDisposer.dispose();
            ws.close();
            term.dispose();
        };
    }, [vmId, t]);

    return (
        <div className="flex h-full min-h-[300px] w-full flex-col rounded-md bg-[#0a0a0a] p-2">
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
};

export default VmConsole;
