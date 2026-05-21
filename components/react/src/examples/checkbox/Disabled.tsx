import { Checkbox } from "../../../lib/components/ui/checkbox";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`flex flex-col gap-2`}>
            <Label className={`flex items-center gap-2 opacity-60`}>
                <Checkbox disabled />
                Disabled unchecked
            </Label>
            <Label className={`flex items-center gap-2 opacity-60`}>
                <Checkbox disabled checked />
                Disabled checked
            </Label>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.checkbox.disabled,
    Example
};

export default module;
