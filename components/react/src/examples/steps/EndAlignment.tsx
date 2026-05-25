import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ comparison: `side vs center end alignment` });

    return (
        <div className={`flex flex-col gap-8`}>
            <div className={`flex flex-col gap-2`}>
                <p className={`text-xs text-muted-foreground`}>
                    endAlignment="side" (default) — first label hugs the left edge,
                    last label hugs the right edge.
                </p>
                <Steps current={1} endAlignment={`side`}>
                    <Step title={`Account`} description={`Sign up`} />
                    <Step title={`Profile`} description={`Tell us about yourself`} />
                    <Step title={`Review`} description={`Confirm your details`} />
                    <Step title={`Done`} />
                </Steps>
            </div>
            <div className={`flex flex-col gap-2`}>
                <p className={`text-xs text-muted-foreground`}>
                    endAlignment="center" — every label is centered under its
                    indicator, including the first and last.
                </p>
                <Steps current={1} endAlignment={`center`}>
                    <Step title={`Account`} description={`Sign up`} />
                    <Step title={`Profile`} description={`Tell us about yourself`} />
                    <Step title={`Review`} description={`Confirm your details`} />
                    <Step title={`Done`} />
                </Steps>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.endAlignment,
    Example
};

export default module;
