import CodeThemePicker from "../../../lib/components/code/codeThemePicker/CodeThemePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <CodeThemePicker />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeThemePicker.popover,
    Example
};

export default module;
