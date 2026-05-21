import ThemePicker from "../../../lib/components/settings/themePicker/ThemePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <ThemePicker />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.themePicker.popover,
    Example
};

export default module;
