import Scheduler from "../../../lib/components/dateTime/scheduler/Scheduler";
import type { ExampleModule } from "../harness/types";
import { buildSampleEvents } from "./sampleEvents";

const events = buildSampleEvents();

const Example = () => {
    return (
        <div className={`h-[36rem] w-full p-4`}>
            <Scheduler events={events} defaultView={`week`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scheduler.default,
    Example
};

export default module;
