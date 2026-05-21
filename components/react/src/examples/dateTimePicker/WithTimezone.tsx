import { useState } from "react";
import DateTimePicker from "../../../lib/components/dateTime/dateTimePicker/DateTimePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<Date | undefined>(new Date());
    const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    useExampleState({ value: value?.toISOString() ?? null, tz });

    return (
        <div className={`max-w-md`}>
            <DateTimePicker
                value={value}
                onChange={setValue}
                timeFormat={`24h`}
                showSeconds
                showTimezone
                timeZone={tz}
                onTimezoneChange={setTz}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dateTimePicker.withTimezone,
    Example
};

export default module;
