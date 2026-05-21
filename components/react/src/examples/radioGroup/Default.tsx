import { useState } from "react";
import { Label } from "../../../lib/components/ui/label";
import {
    RadioGroup,
    RadioGroupItem
} from "../../../lib/components/ui/radio-group";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState(`apple`);
    useExampleState({ value });

    return (
        <RadioGroup value={value} onValueChange={setValue} className={`flex flex-col gap-2`}>
            {[`apple`, `banana`, `cherry`].map((id) => (
                <Label key={id} className={`flex items-center gap-2 capitalize`}>
                    <RadioGroupItem value={id} />
                    {id}
                </Label>
            ))}
        </RadioGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.radioGroup.default,
    Example
};

export default module;
