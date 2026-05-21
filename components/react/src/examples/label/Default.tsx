import { Checkbox } from "../../../lib/components/ui/checkbox";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <Label className={`flex items-center gap-2`}>
            <Checkbox /> Accept terms
        </Label>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.label.default,
    Example
};

export default module;
