import { Input } from "../../../lib/components/ui/input";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex max-w-sm flex-col gap-1.5`}>
            <Label htmlFor={`email`}>Email</Label>
            <Input id={`email`} type={`email`} placeholder={`you@example.com`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.input.default,
    Example
};

export default module;
