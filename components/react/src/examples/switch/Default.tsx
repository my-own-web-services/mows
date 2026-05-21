import { useState } from "react";
import { Switch } from "../../../lib/components/ui/switch";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [on, setOn] = useState(false);
    useExampleState({ on });

    return (
        <Label className={`flex items-center gap-2`}>
            <Switch checked={on} onCheckedChange={setOn} />
            Enable feature
        </Label>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.switch.default,
    Example
};

export default module;
