import { useState } from "react";
import NumberInput from "../../../lib/components/input/numberInput/NumberInput";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<number | null>(2.5);
    useExampleState({ value, integerOnly: false });

    return (
        <div className={`max-w-xs`}>
            <NumberInput
                value={value}
                onChange={setValue}
                min={0.1}
                max={10}
                step={0.1}
                integerOnly={false}
                ariaLabel={`GiB`}
                placeholder={`auto`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.numberInput.decimal,
    Example
};

export default module;
