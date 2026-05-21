import Compass from "../../../lib/components/navigation/compass/Compass";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({
        heading: 80,
        markers: [
            { bearing: 33, label: `Goal` },
            { bearing: 200, label: `Camp` }
        ]
    });

    return (
        <Compass
            heading={80}
            fieldOfView={120}
            tickInterval={5}
            markers={[
                { bearing: 33, label: `Goal` },
                { bearing: 200, label: `Camp` }
            ]}
            className={`max-w-xl`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.compass.markers,
    Example
};

export default module;
