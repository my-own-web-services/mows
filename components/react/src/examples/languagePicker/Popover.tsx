import LanguagePicker from "../../../lib/components/settings/languagePicker/LanguagePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <LanguagePicker />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.languagePicker.popover,
    Example
};

export default module;
