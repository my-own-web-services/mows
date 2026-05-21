import ThemePicker from "../../../lib/components/settings/themePicker/ThemePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: true });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <ThemePicker standalone />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.themePicker.standalone,
    Example
};

export default module;
