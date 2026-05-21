import { useState } from "react";
import { Calendar } from "../../../lib/components/ui/calendar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [date, setDate] = useState<Date | undefined>();
    useExampleState({ disableFuture: true, value: date?.toISOString() ?? null });

    return (
        <Calendar
            mode={`single`}
            selected={date}
            onSelect={setDate}
            disableFuture
            className={`rounded-md border`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.calendar.disableFuture,
    Example
};

export default module;
