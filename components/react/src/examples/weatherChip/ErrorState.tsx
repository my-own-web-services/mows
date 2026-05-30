import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ error: `Sample feed unavailable` });

    return (
        <WeatherChip
            error={`Sample feed unavailable`}
            data={{
                temperature: 11.2,
                condition: `cloudy`,
                icon: `cloudy`
            }}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.error,
    Example
};

export default module;
