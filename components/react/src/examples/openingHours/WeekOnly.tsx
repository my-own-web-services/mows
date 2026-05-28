import OpeningHours from "../../../lib/components/dateTime/openingHours/OpeningHours";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const RULE = `Mo-Th 09:00-22:00; Fr-Sa 09:00-02:00; Su 12:00-22:00`;

const Example = () => {
    useExampleState({ rules: RULE, variant: `week` });
    return (
        <div className={`w-full max-w-sm`}>
            <OpeningHours rules={RULE} variant={`week`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.openingHours.weekOnly,
    Example
};

export default module;
