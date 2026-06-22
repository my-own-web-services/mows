import { useState } from "react";

import Scheduler from "../../../lib/components/dateTime/scheduler/Scheduler";
import type {
    MoveChange,
    ScheduleItem,
    SlotInfo
} from "../../../lib/components/dateTime/scheduler/types";
import type { ExampleModule } from "../harness/types";
import { buildSampleEvents } from "./sampleEvents";

/** Full interaction demo: click an item (`onSelectItem`), click empty space to
 *  add one (`onSelectSlot`), and DRAG an item to reschedule it (`onItemMove`).
 *  Every item is marked `editable` here; in real use you'd only flag the ones
 *  the user owns (feed items stay fixed). The calendar is controlled — the
 *  example applies the move to its own state. */
const Example = () => {
    const [events, setEvents] = useState<ScheduleItem[]>(() =>
        buildSampleEvents().map((e) => ({ ...e, editable: true }))
    );
    const [last, setLast] = useState(
        `Drag an item (week/day view) to reschedule it, click one to select, or an empty slot to add.`
    );

    return (
        <div className={`flex h-[36rem] w-full flex-col gap-2 p-4`}>
            <Scheduler
                events={events}
                defaultView={`week`}
                onSelectItem={(e: ScheduleItem) => setLast(`Selected: ${e.title}`)}
                onSelectSlot={(s: SlotInfo) =>
                    setLast(`New ${s.allDay ? `all-day` : `timed`} slot at ${s.start.toLocaleString()}`)
                }
                onItemMove={(item: ScheduleItem, change: MoveChange) => {
                    setEvents((prev) =>
                        prev.map((e) =>
                            e.id === item.id ? { ...e, start: change.start, end: change.end } : e
                        )
                    );
                    setLast(`Moved "${item.title}" → ${change.start.toLocaleString()}`);
                }}
                onCreate={() => setLast(`Add-event button pressed`)}
            />
            <p className={`text-sm text-muted-foreground`} aria-live={`polite`}>
                {last}
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scheduler.selection,
    Example
};

export default module;
