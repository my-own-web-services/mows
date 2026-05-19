import CodeThemePicker from "../../../lib/components/code/codeThemePicker/CodeThemePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: true });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <CodeThemePicker standalone />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeThemePicker.standalone,
    Example
};

export default module;
