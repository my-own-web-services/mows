import { Label } from "../../../lib/components/ui/label";
import { Textarea } from "../../../lib/components/ui/textarea";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex max-w-md flex-col gap-1.5`}>
            <Label htmlFor={`bio`}>Bio</Label>
            <Textarea id={`bio`} placeholder={`Tell us about yourself…`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.textarea.default,
    Example
};

export default module;
