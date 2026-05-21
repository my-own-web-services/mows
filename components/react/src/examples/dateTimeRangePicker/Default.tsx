import { useState } from "react";
import DateTimeRangePicker from "../../../lib/components/dateTime/dateTimeRangePicker/DateTimeRangePicker";
import type { DateTimeRange } from "../../../lib/components/dateTime/dateTimeRangePicker/useDateTimeRangePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [range, setRange] = useState<DateTimeRange>({ from: new Date(), to: undefined });
    useExampleState({
        from: range.from?.toISOString() ?? null,
        to: range.to?.toISOString() ?? null
    });

    return <DateTimeRangePicker value={range} onChange={setRange} />;
};

const module: ExampleModule = {
    strings: (t) => t.examples.dateTimeRangePicker.default,
    Example
};

export default module;
