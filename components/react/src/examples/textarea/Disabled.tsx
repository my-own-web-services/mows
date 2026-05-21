import { Label } from "../../../lib/components/ui/label";
import { Textarea } from "../../../lib/components/ui/textarea";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`flex max-w-md flex-col gap-1.5`}>
            <Label htmlFor={`disabled-bio`}>Read-only bio</Label>
            <Textarea
                id={`disabled-bio`}
                disabled
                defaultValue={`This textarea is read-only.\nNew lines included.`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.textarea.disabled,
    Example
};

export default module;
