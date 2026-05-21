import { useState } from "react";
import { Button } from "../../../lib/components/ui/button";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const PANELS = [
    { title: `Account`, body: `Pick a username and password to get started.` },
    { title: `Profile`, body: `Tell us a bit about yourself.` },
    { title: `Review`, body: `Looks good? Confirm your details below.` },
    { title: `Done`, body: `All set — welcome aboard.` }
];

const Example = () => {
    const [current, setCurrent] = useState(0);
    const total = PANELS.length;
    const panel = PANELS[current];

    useExampleState({ current, total, panel: panel.title });

    return (
        <div className={`flex flex-col gap-4`}>
            <Steps current={current}>
                {PANELS.map((p) => (
                    <Step key={p.title} title={p.title} />
                ))}
            </Steps>
            <div
                className={`rounded-md border bg-background p-4 text-sm text-muted-foreground`}
            >
                <p className={`mb-1 font-medium text-foreground`}>{panel.title}</p>
                <p>{panel.body}</p>
            </div>
            <div className={`flex gap-2`}>
                <Button
                    size={`sm`}
                    variant={`outline`}
                    onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
                    disabled={current === 0}
                >
                    Back
                </Button>
                <Button
                    size={`sm`}
                    onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))}
                    disabled={current === total - 1}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.wizard,
    Example
};

export default module;
