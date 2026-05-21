import { Input } from "../../../lib/components/ui/input";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`flex max-w-sm flex-col gap-1.5`}>
            <Label htmlFor={`disabled`}>Read-only field</Label>
            <Input id={`disabled`} disabled defaultValue={`read-only`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.input.disabled,
    Example
};

export default module;
