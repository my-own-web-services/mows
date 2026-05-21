import { useState } from "react";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const labels = [`Account`, `Profile`, `Review`, `Done`];

const Example = () => {
    const [current, setCurrent] = useState(1);

    useExampleState({ mode: `selection`, current });

    return (
        <div className={`flex flex-col gap-4`}>
            <Steps current={current} mode={`selection`}>
                {labels.map((label, index) => (
                    <Step
                        key={label}
                        title={label}
                        className={`cursor-pointer`}
                        onClick={() => setCurrent(index)}
                    />
                ))}
            </Steps>
            <p className={`text-muted-foreground text-xs`}>
                Click any step to switch the active selection. Earlier steps are
                never rendered as completed in this mode.
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.selection,
    Example
};

export default module;
