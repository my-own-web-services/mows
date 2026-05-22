import { useState } from "react";
import LocationPicker, {
    type PickedLocation
} from "../../../lib/components/input/locationPicker/LocationPicker";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

const Example = () => {
    const [picked, setPicked] = useState<PickedLocation | null>(null);
    useExampleState({ picked });

    return (
        <div className={`w-full max-w-2xl`}>
            <LocationPicker
                value={picked}
                onChange={setPicked}
                initialView={{ longitude: 10.45, latitude: 51.16, zoom: 4 }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.locationPicker.default,
    Example
};

export default module;
