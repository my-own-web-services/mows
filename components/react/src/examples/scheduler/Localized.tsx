import Scheduler from "../../../lib/components/dateTime/scheduler/Scheduler";
import type { ExampleModule } from "../harness/types";
import { buildSampleEvents } from "./sampleEvents";

const events = buildSampleEvents();

/** `locale` + `weekStartsOn` override the provider language for this instance.
 *  Here US English with a Sunday-first week and 12-hour times, regardless of
 *  the app's active language. */
const Example = () => {
    return (
        <div className={`h-[36rem] w-full p-4`}>
            <Scheduler
                events={events}
                locale={`en-US`}
                weekStartsOn={0}
                defaultView={`month`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scheduler.localized,
    Example
};

export default module;
