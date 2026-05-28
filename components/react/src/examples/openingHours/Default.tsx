import OpeningHours from "../../../lib/components/dateTime/openingHours/OpeningHours";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const RULE = `Mo-Fr 09:00-18:00; Sa 10:00-14:00`;

const Example = () => {
    useExampleState({ rules: RULE });
    return (
        <div className={`w-full max-w-sm`}>
            <OpeningHours rules={RULE} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.openingHours.default,
    Example
};

export default module;
