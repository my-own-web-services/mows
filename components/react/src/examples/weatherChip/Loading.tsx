import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ loading: true });

    return (
        <WeatherChip
            loading
            data={{
                temperature: 14.6,
                condition: `dry`,
                icon: `partly-cloudy-day`,
                windSpeed: 9
            }}
            attribution={`Demo data`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.loading,
    Example
};

export default module;
