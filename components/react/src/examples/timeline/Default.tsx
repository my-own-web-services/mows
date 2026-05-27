import { Timeline, type TimelineEvent } from "../../../lib/components/input/timeline/Timeline";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const FROM = Date.UTC(2026, 0, 15, 8, 0, 0);
const TO = Date.UTC(2026, 0, 15, 18, 0, 0);
const HOUR = 60 * 60_000;

const events: TimelineEvent[] = [
    { id: `build`, timestamp: FROM + 1 * HOUR, title: `Build start`, status: `info` },
    { id: `tests`, timestamp: FROM + 2 * HOUR, title: `Tests passed`, status: `success` },
    {
        id: `deploy`,
        timestamp: FROM + 3 * HOUR,
        endTimestamp: FROM + 5 * HOUR,
        title: `Rollout`,
        status: `success`
    },
    { id: `alert`, timestamp: FROM + 6 * HOUR, title: `Latency spike`, status: `warning` },
    { id: `rollback`, timestamp: FROM + 7 * HOUR, title: `Rolled back`, status: `error` },
    { id: `done`, timestamp: FROM + 9 * HOUR, title: `Stable`, status: `success` }
];

const Example = () => {
    useExampleState({ from: FROM, to: TO, eventCount: events.length });

    return (
        <Timeline
            from={FROM}
            to={TO}
            events={events}
            title={`Deployment history`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timeline.default,
    Example
};

export default module;
