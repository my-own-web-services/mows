import { useState } from "react";
import Compass from "../../../lib/components/navigation/compass/Compass";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [heading, setHeading] = useState(0);
    useExampleState({ heading });

    return (
        <div className={`flex max-w-xl flex-col gap-4`}>
            <Compass heading={heading} />
            <div className={`flex items-center gap-3`}>
                <span className={`text-muted-foreground w-12 text-xs`}>0°</span>
                <Slider
                    value={[heading]}
                    onValueChange={(v) => setHeading(v[0] ?? 0)}
                    min={0}
                    max={360}
                    step={1}
                    className={`flex-1`}
                />
                <span className={`text-muted-foreground w-12 text-right text-xs`}>
                    360°
                </span>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.compass.default,
    Example
};

export default module;
