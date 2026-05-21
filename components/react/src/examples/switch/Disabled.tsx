import { Switch } from "../../../lib/components/ui/switch";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`flex flex-col gap-2`}>
            <Label className={`flex items-center gap-2 opacity-60`}>
                <Switch disabled />
                Disabled off
            </Label>
            <Label className={`flex items-center gap-2 opacity-60`}>
                <Switch disabled defaultChecked />
                Disabled on
            </Label>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.switch.disabled,
    Example
};

export default module;
