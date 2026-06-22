import Scheduler from "../../../lib/components/dateTime/scheduler/Scheduler";
import type { ExampleModule } from "../harness/types";
import { buildSampleEvents } from "./sampleEvents";

const events = buildSampleEvents();

/** `minHour` / `maxHour` crop the time grid to a working day, and
 *  `slotMinutes` sets the click-to-add granularity. Shown in the day view. */
const Example = () => {
    return (
        <div className={`h-[36rem] w-full p-4`}>
            <Scheduler
                events={events}
                defaultView={`day`}
                minHour={7}
                maxHour={20}
                slotMinutes={15}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scheduler.businessHours,
    Example
};

export default module;
