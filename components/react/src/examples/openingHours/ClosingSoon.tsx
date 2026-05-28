import OpeningHours from "../../../lib/components/dateTime/openingHours/OpeningHours";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const RULE = `Mo-Fr 09:00-18:00`;
// Pin `now` to a Wednesday 17:30 local time so the schedule lands
// inside the final 60 minutes of the open window — that's when the
// "Closing soon" amber tone kicks in.
const FROZEN_NOW = new Date(2026, 0, 14, 17, 30, 0);

const Example = () => {
    useExampleState({ rules: RULE, now: FROZEN_NOW.toISOString() });
    return (
        <div className={`w-full max-w-sm`}>
            <OpeningHours rules={RULE} now={FROZEN_NOW} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.openingHours.closingSoon,
    Example
};

export default module;
