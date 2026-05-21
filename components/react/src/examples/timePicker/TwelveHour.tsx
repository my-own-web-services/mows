import { useState } from "react";
import TimePicker from "../../../lib/components/dateTime/dateTimePicker/TimePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [date, setDate] = useState(new Date());
    useExampleState({ format: `12h` });

    return (
        <div className={`max-w-fit rounded-md border p-2`}>
            <TimePicker date={date} onChange={setDate} timeFormat={`12h`} showSeconds={false} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timePicker.twelveHour,
    Example
};

export default module;
