import { useState } from "react";
import NumberInput from "../../../lib/components/input/numberInput/NumberInput";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<number | null>(8);
    useExampleState({ value });

    return (
        <div className={`max-w-xs`}>
            <NumberInput value={value} onChange={setValue} min={0} max={64} step={1} ariaLabel={`vCPUs`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.numberInput.default,
    Example
};

export default module;
