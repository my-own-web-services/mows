import CopyValueButton from "../../../lib/components/input/copyValueButton/CopyValueButton";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ value: `compact-value`, hasLabel: false });

    return (
        <div className={`flex items-center gap-2`}>
            <code className={`text-sm`}>compact-value</code>
            <CopyValueButton value={`compact-value`} title={`Copy value`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.copyValueButton.iconOnly,
    Example
};

export default module;
