import { useState } from "react";
import { Checkbox } from "../../../lib/components/ui/checkbox";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [checked, setChecked] = useState(false);
    useExampleState({ checked });

    return (
        <Label className={`flex items-center gap-2`}>
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
            />
            Accept terms
        </Label>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.checkbox.default,
    Example
};

export default module;
