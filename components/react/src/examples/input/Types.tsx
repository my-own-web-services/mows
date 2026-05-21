import { Input } from "../../../lib/components/ui/input";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex max-w-sm flex-col gap-3`}>
            <div className={`flex flex-col gap-1.5`}>
                <Label htmlFor={`text`}>Text</Label>
                <Input id={`text`} placeholder={`type something…`} />
            </div>
            <div className={`flex flex-col gap-1.5`}>
                <Label htmlFor={`password`}>Password</Label>
                <Input id={`password`} type={`password`} placeholder={`••••••••`} />
            </div>
            <div className={`flex flex-col gap-1.5`}>
                <Label htmlFor={`number`}>Number</Label>
                <Input id={`number`} type={`number`} defaultValue={42} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.input.types,
    Example
};

export default module;
