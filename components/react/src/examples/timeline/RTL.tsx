import { Timeline, type TimelineEvent } from "../../../lib/components/input/timeline/Timeline";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const FROM = Date.UTC(2026, 0, 15, 8, 0, 0);
const TO = Date.UTC(2026, 0, 15, 16, 0, 0);
const HOUR = 60 * 60_000;

const events: TimelineEvent[] = [
    { id: `e1`, timestamp: FROM + 1 * HOUR, title: `بدء البناء`, status: `info` },
    { id: `e2`, timestamp: FROM + 3 * HOUR, title: `نجاح الاختبارات`, status: `success` },
    {
        id: `e3`,
        timestamp: FROM + 4 * HOUR,
        endTimestamp: FROM + 6 * HOUR,
        title: `نشر تدريجي`,
        status: `success`
    },
    { id: `e4`, timestamp: FROM + 7 * HOUR, title: `اكتمل`, status: `default` }
];

const Example = () => {
    useExampleState({ dir: `rtl` });

    return (
        <div dir={`rtl`}>
            <Timeline from={FROM} to={TO} events={events} title={`تاريخ النشر`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timeline.rtl,
    Example
};

export default module;
