import { Input } from "../../../lib/components/ui/input";
import { Label } from "../../../lib/components/ui/label";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ htmlFor: `username` });

    return (
        <div className={`flex max-w-sm flex-col gap-1.5`}>
            <Label htmlFor={`username`}>Username</Label>
            <Input id={`username`} placeholder={`alice`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.label.htmlFor,
    Example
};

export default module;
