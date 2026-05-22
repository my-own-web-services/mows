import MapStylePicker from "../../../lib/components/settings/mapStylePicker/MapStylePicker";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

const Example = () => {
    useExampleState({ standalone: true });

    return (
        <div className={`max-w-sm rounded-md border`}>
            <MapStylePicker standalone />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.mapStylePicker.standalone,
    Example
};

export default module;
