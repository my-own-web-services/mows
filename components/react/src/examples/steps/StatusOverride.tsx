import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({
        current: 1,
        overrides: { upload: `completed`, process: `current`, publish: `upcoming` }
    });

    return (
        <Steps current={1}>
            <Step title={`Upload`} status={`completed`} />
            <Step title={`Process`} status={`current`} />
            <Step title={`Publish`} status={`upcoming`} />
        </Steps>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.statusOverride,
    Example
};

export default module;
