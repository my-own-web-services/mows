import Map from "../../../lib/components/map/Map";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

const Example = () => {
    useExampleState({ standalone: false });

    return (
        <div className={`h-[400px] w-full overflow-hidden rounded-md border`}>
            <Map
                projection={`globe`}
                initialView={{ longitude: 10.45, latitude: 51.16, zoom: 1.5 }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.map.default,
    Example
};

export default module;
