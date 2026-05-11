import { Button } from "mows-components-react/components/ui/button";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { agentIoWsUrl, stopAgent, type AgentSummary } from "../lib/api";
import StatusBadge from "./StatusBadge";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

interface Props {
    readonly agent: AgentSummary;
}

const AgentPane = ({ agent }: Props) => {
    const { t } = useMows();
    const [tab, setTab] = useState<"terminal" | "chat">("chat");
    const [draft, setDraft] = useState("");
    const [chatLog, setChatLog] = useState<{ role: "user" | "agent"; text: string }[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const termContainerRef = useRef<HTMLDivElement | null>(null);
    const termRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (agent.status === "stopped" || agent.status === "failed") return;

        const ws = new WebSocket(agentIoWsUrl(agent.id));
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onmessage = (ev) => {
            const text =
                ev.data instanceof ArrayBuffer
                    ? new TextDecoder().decode(new Uint8Array(ev.data))
                    : (ev.data as string);
            termRef.current?.write(text);
            setChatLog((prev) => {
                const stripped = text
                    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
                    .replace(/\r/g, "");
                if (!stripped.trim()) return prev;
                const last = prev[prev.length - 1];
                if (last && last.role === "agent") {
                    return [
                        ...prev.slice(0, -1),
                        { role: "agent", text: last.text + stripped }
                    ];
                }
                return [...prev, { role: "agent", text: stripped }];
            });
        };
        ws.onclose = () => {
            wsRef.current = null;
        };
        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [agent.id, agent.status]);

    useEffect(() => {
        if (tab !== "terminal" || !termContainerRef.current || termRef.current) {
            return;
        }
        const term = new Terminal({
            convertEol: false,
            cursorBlink: true,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            theme: { background: "#0a0a0a" }
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(termContainerRef.current);
        fit.fit();
        const onResize = () => {
            try {
                fit.fit();
            } catch {
                /* container detached */
            }
        };
        window.addEventListener("resize", onResize);

        const dataDisp = term.onData((data) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(new TextEncoder().encode(data));
            }
        });
        termRef.current = term;
        return () => {
            window.removeEventListener("resize", onResize);
            dataDisp.dispose();
            term.dispose();
            termRef.current = null;
        };
    }, [tab]);

    const sendChat = () => {
        const text = draft.trim();
        if (!text) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            toast.error(t.supervisor.agents.notConnected);
            return;
        }
        wsRef.current.send(new TextEncoder().encode(text + "\n"));
        setChatLog((prev) => [...prev, { role: "user", text }]);
        setDraft("");
    };

    const handleStop = async () => {
        try {
            await stopAgent(agent.id);
            toast.success(`stopped ${agent.id.slice(0, 8)}`);
        } catch (e) {
            toast.error(String(e));
        }
    };

    return (
        <div className="border-border bg-card flex h-[420px] flex-col rounded-md border">
            <header className="border-border flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium">{agent.kind}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                        {agent.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={agent.status} className="text-[10px]" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-muted flex rounded p-0.5 text-xs">
                        <button
                            onClick={() => setTab("chat")}
                            className={`rounded px-2 py-1 ${tab === "chat" ? "bg-background" : ""}`}
                        >
                            {t.supervisor.agents.tabChat}
                        </button>
                        <button
                            onClick={() => setTab("terminal")}
                            className={`rounded px-2 py-1 ${tab === "terminal" ? "bg-background" : ""}`}
                        >
                            {t.supervisor.agents.tabTerminal}
                        </button>
                    </div>
                    {agent.status !== "stopped" && agent.status !== "failed" && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleStop}
                            title={t.supervisor.agents.stop}
                        >
                            <Square className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </header>

            {tab === "terminal" ? (
                <div ref={termContainerRef} className="flex-1 bg-[#0a0a0a] p-2" />
            ) : (
                <>
                    <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                        {chatLog.length === 0 ? (
                            <div className="text-muted-foreground text-xs italic">
                                {t.supervisor.agents.chatWaiting}
                            </div>
                        ) : (
                            chatLog.map((m, i) => (
                                <div
                                    key={i}
                                    className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                                        m.role === "user"
                                            ? "bg-primary text-primary-foreground self-end"
                                            : "bg-muted"
                                    }`}
                                >
                                    {m.text}
                                </div>
                            ))
                        )}
                    </div>
                    <form
                        className="border-border flex gap-2 border-t p-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            sendChat();
                        }}
                    >
                        <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={t.supervisor.agents.chatPlaceholder}
                            disabled={agent.status === "stopped" || agent.status === "failed"}
                            className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
                        />
                        <Button type="submit" size="sm">
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
};

export default AgentPane;
