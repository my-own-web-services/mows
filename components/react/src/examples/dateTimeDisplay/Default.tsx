import DateTimeDisplay from "../../../lib/components/dateTime/dateTimeDisplay/DateTimeDisplay";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE_TS = Date.UTC(2026, 0, 15, 9, 30, 0);
const SAMPLE_NAIVE = `2026-01-15 09:30:00`;

const Example = () => {
    useExampleState({ timestampMs: SAMPLE_TS, naive: SAMPLE_NAIVE });

    return (
        <div className={`flex flex-col gap-2 text-sm`}>
            <div>
                Now: <DateTimeDisplay timestampMilliseconds={Date.now()} />
            </div>
            <div>
                Fixed timestamp: <DateTimeDisplay timestampMilliseconds={SAMPLE_TS} />
            </div>
            <div>
                Naive (local): <DateTimeDisplay dateTimeNaive={SAMPLE_NAIVE} />
            </div>
            <div>
                Naive (UTC): <DateTimeDisplay dateTimeNaive={SAMPLE_NAIVE} utcTime />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dateTimeDisplay.default,
    Example
};

export default module;
