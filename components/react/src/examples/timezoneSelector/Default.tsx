import { useState } from "react";
import TimezoneSelector from "../../../lib/components/dateTime/dateTimePicker/TimezoneSelector";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    useExampleState({ tz });

    return (
        <div className={`max-w-sm`}>
            <TimezoneSelector value={tz} onChange={setTz} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.timezoneSelector.default,
    Example
};

export default module;
