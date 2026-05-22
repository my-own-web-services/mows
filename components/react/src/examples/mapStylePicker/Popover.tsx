import MapStylePicker from "../../../lib/components/settings/mapStylePicker/MapStylePicker";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`max-w-sm rounded-md border`}>
            <MapStylePicker />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.mapStylePicker.popover,
    Example
};

export default module;
