import LanguagePicker from "../../../lib/components/settings/languagePicker/LanguagePicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: true });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <LanguagePicker standalone />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.languagePicker.standalone,
    Example
};

export default module;
