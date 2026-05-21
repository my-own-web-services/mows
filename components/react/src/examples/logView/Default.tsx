import { useRef, useState } from "react";
import LogView from "../../../lib/components/console/logView/LogView";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE: ReadonlyArray<string> = [
    `[2026-05-12 10:14:21] starting nginx worker pool (4 workers)`,
    `worker 0 listening on :8080`,
    `worker 1 listening on :8080`,
    `127.0.0.1 - - "GET /healthz HTTP/1.1" 200 2`,
    `127.0.0.1 - - "GET /api/users HTTP/1.1" 200 1842`,
    `[warn] upstream took 1.4s to respond`,
    `[error] connection refused: db.mows.local:5432`,
    `[2026-05-12 10:14:23] retrying upstream connection (attempt 2/5)`
];

const Example = () => {
    const [lines, setLines] = useState<ReadonlyArray<string>>([]);
    const idxRef = useRef(0);
    useExampleState({ lineCount: lines.length });

    const pushLine = () => {
        const line = SAMPLE[idxRef.current % SAMPLE.length]!;
        idxRef.current++;
        setLines((prev) => [...prev, line]);
    };

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`flex flex-wrap gap-2`}>
                <Button size={`sm`} onClick={pushLine}>
                    Push line
                </Button>
            </div>
            <div className={`h-[360px]`}>
                <LogView
                    lines={lines}
                    onClear={() => setLines([])}
                    placeholders={{
                        search: `Search lines…`,
                        empty: `No lines yet — press "Push line".`
                    }}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.logView.default,
    Example
};

export default module;
