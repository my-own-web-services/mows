import LogView from "../../../lib/components/console/logView/LogView";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const LINES = [
    `[2026-05-12 10:14:21] starting nginx worker pool (4 workers)`,
    `worker 0 listening on :8080`,
    `[warn] upstream took 1.4s to respond`,
    `[error] connection refused: db.mows.local:5432`
];

const Example = () => {
    useExampleState({ hideToolbar: true });

    return (
        <div className={`h-[200px]`}>
            <LogView lines={LINES} hideToolbar />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.logView.hideToolbar,
    Example
};

export default module;
