import { useRef } from "react";
import Terminal, {
    type TerminalHandle
} from "../../../lib/components/console/terminal/Terminal";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const ref = useRef<TerminalHandle>(null);
    const bufferRef = useRef(``);
    useExampleState({ hasHandle: true });

    const handleData = (data: string) => {
        const term = ref.current;
        if (!term) return;
        for (const ch of data) {
            const code = ch.charCodeAt(0);
            if (ch === `\r`) {
                term.write(`\r\n`);
                if (bufferRef.current.length > 0) {
                    term.write(`echoed: ${bufferRef.current}\r\n`);
                }
                bufferRef.current = ``;
                term.write(`$ `);
            } else if (code === 0x7f) {
                if (bufferRef.current.length > 0) {
                    bufferRef.current = bufferRef.current.slice(0, -1);
                    term.write(`\b \b`);
                }
            } else if (code >= 32) {
                bufferRef.current += ch;
                term.write(ch);
            }
        }
    };

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`flex flex-wrap gap-2`}>
                <Button
                    size={`sm`}
                    variant={`outline`}
                    onClick={() => ref.current?.clear()}
                >
                    Clear
                </Button>
            </div>
            <div className={`h-[360px] overflow-hidden rounded-md border p-2`}>
                <Terminal
                    ref={ref}
                    onData={handleData}
                    onReady={(handle) => {
                        handle.write(`Welcome to mows-components Terminal demo\r\n$ `);
                        handle.focus();
                    }}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.terminal.default,
    Example
};

export default module;
