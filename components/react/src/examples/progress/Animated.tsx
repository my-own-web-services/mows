import { useEffect, useState } from "react";
import { Progress } from "../../../lib/components/ui/progress";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState(0);
    useExampleState({ value });

    useEffect(() => {
        const id = setInterval(() => {
            setValue((v) => (v >= 100 ? 0 : v + 5));
        }, 350);
        return () => clearInterval(id);
    }, []);

    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <Progress value={value} />
            <span className={`text-xs text-muted-foreground tabular-nums`}>{value}%</span>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.progress.animated,
    Example
};

export default module;
