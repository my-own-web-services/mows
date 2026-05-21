import { useState } from "react";
import TimePicker from "../../../lib/components/dateTime/dateTimePicker/TimePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [date, setDate] = useState(new Date());
    useExampleState({ time: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}` });

    return (
        <div className={`max-w-fit rounded-md border p-2`}>
            <TimePicker date={date} onChange={setDate} timeFormat={`24h`} showSeconds />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timePicker.default,
    Example
};

export default module;
