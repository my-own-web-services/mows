import { useState } from "react";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<number[]>([20, 80]);
    useExampleState({ value });

    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <Slider value={value} onValueChange={setValue} min={0} max={100} step={1} />
            <span className={`text-xs text-muted-foreground tabular-nums`}>
                {value[0]} – {value[1]}
            </span>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.slider.range,
    Example
};

export default module;
