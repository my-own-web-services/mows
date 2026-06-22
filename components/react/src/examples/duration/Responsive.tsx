import Duration from "../../../lib/components/dateTime/duration/Duration";
import type { ExampleModule } from "../harness/types";

const SAMPLE_SECONDS = 60 * 60 + 10 * 60;

/**
 * Three columns of decreasing width that share the same input. The
 * component picks the longest label that still fits each column —
 * `1 h 10 min` → `1 h 10 m` → `1 h 10` as the slot shrinks.
 */
const Example = () => {
    return (
        <div className={`flex w-full flex-col items-center gap-4 p-6`}>
            <div className={`w-32 rounded-md border bg-card px-2 py-1 text-center`}>
                <Duration seconds={SAMPLE_SECONDS} />
            </div>
            <div className={`w-[5.5rem] rounded-md border bg-card px-2 py-1 text-center`}>
                <Duration seconds={SAMPLE_SECONDS} />
            </div>
            <div className={`w-16 rounded-md border bg-card px-2 py-1 text-center`}>
                <Duration seconds={SAMPLE_SECONDS} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.duration.responsive,
    Example
};

export default module;
