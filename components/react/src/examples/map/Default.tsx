import Map from "../../../lib/components/map/Map";
import MapStylePicker from "../../../lib/components/settings/mapStylePicker/MapStylePicker";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

// The picker writes to MowsContext via setMapStyle, and the Map below
// reads currentMapStyle from the same context — so switching styles in
// the picker reflows the map without any local wiring.
const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`flex flex-col gap-3`}>
            <MapStylePicker className={`max-w-xs`} />
            <div className={`h-[400px] w-full overflow-hidden rounded-md border`}>
                <Map
                    projection={`globe`}
                    initialView={{ longitude: 10.45, latitude: 51.16, zoom: 1.5 }}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.map.default,
    Example
};

export default module;
