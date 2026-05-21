import { useState } from "react";
import { Button } from "../../../lib/components/ui/button";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [current, setCurrent] = useState(1);
    const total = 4;

    useExampleState({ orientation: `vertical`, current });

    return (
        <div className={`flex flex-col gap-4`}>
            <Steps orientation={`vertical`} current={current} className={`max-w-sm`}>
                <Step title={`Account`} description={`Sign up`} />
                <Step title={`Profile`} description={`Tell us about yourself`} />
                <Step title={`Review`} description={`Confirm your details`} />
                <Step title={`Done`} />
            </Steps>
            <div className={`flex gap-2`}>
                <Button
                    size={`sm`}
                    onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))}
                    disabled={current >= total - 1}
                >
                    Next
                </Button>
                <Button
                    size={`sm`}
                    variant={`outline`}
                    onClick={() => setCurrent(0)}
                    disabled={current === 0}
                >
                    Reset
                </Button>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.vertical,
    Example
};

export default module;
