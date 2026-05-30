import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({
        mode: `current`,
        temperature: 16.4,
        condition: `dry`,
        icon: `clear-day`
    });

    return (
        <WeatherChip
            data={{
                temperature: 16.4,
                condition: `dry`,
                icon: `clear-day`,
                windSpeed: 12.5,
                relativeHumidity: 42
            }}
            attribution={`Demo data`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.current,
    Example
};

export default module;
