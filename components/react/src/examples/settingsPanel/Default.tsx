import SettingsPanel from "../../../lib/components/settings/settingsPanel/SettingsPanel";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ height: 640 });

    return (
        <div className={`h-[640px] rounded-md border bg-card`}>
            <SettingsPanel />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.settingsPanel.default,
    Example
};

export default module;
