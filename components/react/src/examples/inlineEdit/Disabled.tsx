import InlineEdit from "../../../lib/components/input/inlineEdit/InlineEdit";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`flex items-center gap-3 text-sm`}>
            <span className={`text-muted-foreground`}>Name:</span>
            <InlineEdit
                value={`read-only-resource`}
                onCommit={() => {}}
                disabled
                ariaLabel={`Read-only resource name`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inlineEdit.disabled,
    Example
};

export default module;
