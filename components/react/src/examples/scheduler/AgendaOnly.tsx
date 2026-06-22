import Scheduler from "../../../lib/components/dateTime/scheduler/Scheduler";
import type { ExampleModule } from "../harness/types";
import { buildSampleEvents } from "./sampleEvents";

const events = buildSampleEvents();

/** Restricting `views` to a single entry hides the switcher entirely — here
 *  a pure upcoming-events list, ideal for a narrow sidebar or a mobile pane. */
const Example = () => {
    return (
        <div className={`h-[36rem] w-full max-w-md p-4`}>
            <Scheduler events={events} views={[`agenda`]} defaultView={`agenda`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scheduler.agendaOnly,
    Example
};

export default module;
