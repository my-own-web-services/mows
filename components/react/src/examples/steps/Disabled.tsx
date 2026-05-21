import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true, current: 1 });

    return (
        <div
            aria-disabled
            className={`pointer-events-none opacity-50`}
            title={`Disabled`}
        >
            <Steps current={1}>
                <Step title={`Account`} description={`Sign up`} />
                <Step title={`Profile`} description={`Tell us about yourself`} />
                <Step title={`Review`} description={`Confirm your details`} />
                <Step title={`Done`} />
            </Steps>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.disabled,
    Example
};

export default module;
