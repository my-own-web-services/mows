import { useEffect, useState } from "react";
import { Button } from "../../../lib/components/ui/button";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [progress, setProgress] = useState(0);
    const [running, setRunning] = useState(true);

    useEffect(() => {
        if (!running) return;
        if (progress >= 100) return;
        const id = window.setInterval(() => {
            setProgress((p) => Math.min(100, p + 4));
        }, 200);
        return () => window.clearInterval(id);
    }, [running, progress]);

    useExampleState({ progress, running });

    return (
        <div className={`flex flex-col gap-8`}>
            <div className={`flex flex-col gap-2`}>
                <p className={`text-xs text-muted-foreground`}>
                    loading=true — the active step shows an indeterminate spinner
                    around its indicator while you wait for a result.
                </p>
                <Steps current={1}>
                    <Step title={`Account`} description={`Sign up`} />
                    <Step
                        title={`Profile`}
                        description={`Saving…`}
                        loading
                    />
                    <Step title={`Review`} />
                    <Step title={`Done`} />
                </Steps>
            </div>
            <div className={`flex flex-col gap-2`}>
                <p className={`text-xs text-muted-foreground`}>
                    loading={`{n}`} (0–100) — the active step renders a real
                    progress ring you can drive from your own state.
                </p>
                <Steps current={2}>
                    <Step title={`Account`} description={`Sign up`} />
                    <Step title={`Profile`} description={`Tell us about yourself`} />
                    <Step
                        title={`Upload`}
                        description={`${progress}% uploaded`}
                        loading={progress}
                    />
                    <Step title={`Done`} />
                </Steps>
                <div className={`flex gap-2`}>
                    <Button
                        size={`sm`}
                        onClick={() => {
                            setProgress(0);
                            setRunning(true);
                        }}
                    >
                        Restart
                    </Button>
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        onClick={() => setRunning((r) => !r)}
                    >
                        {running ? `Pause` : `Resume`}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.loading,
    Example
};

export default module;
