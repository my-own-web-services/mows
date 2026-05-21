import { Checkbox } from "../../../lib/components/ui/checkbox";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ checked: `indeterminate` });

    return (
        <div className={`flex items-center gap-3`}>
            <Checkbox checked={`indeterminate`} aria-label={`indeterminate`} />
            <span className={`text-sm text-muted-foreground`}>
                Pass <code>checked="indeterminate"</code> for the tri-state mode.
            </span>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.checkbox.indeterminate,
    Example
};

export default module;
