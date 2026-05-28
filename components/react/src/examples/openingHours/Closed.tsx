import OpeningHours from "../../../lib/components/dateTime/openingHours/OpeningHours";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const RULE = `Mo-Fr 09:00-18:00; Sa 10:00-14:00`;
// Sunday 14:00 — past Saturday's window, before Monday's opening.
const FROZEN_NOW = new Date(2026, 0, 18, 14, 0, 0);

const Example = () => {
    useExampleState({ rules: RULE, now: FROZEN_NOW.toISOString() });
    return (
        <div className={`w-full max-w-sm`}>
            <OpeningHours rules={RULE} now={FROZEN_NOW} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.openingHours.closed,
    Example
};

export default module;
