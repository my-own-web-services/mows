import { useState } from "react";
import DateTimePicker from "../../../lib/components/dateTime/dateTimePicker/DateTimePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<Date | undefined>(new Date());
    useExampleState({ value: value?.toISOString() ?? null });

    return (
        <div className={`max-w-md`}>
            <DateTimePicker value={value} onChange={setValue} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dateTimePicker.default,
    Example
};

export default module;
