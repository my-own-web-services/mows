import WeatherExpandable from "../../../lib/components/map/weatherExpandable/WeatherExpandable";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// No forecast and no extras → the disclosure body is empty when
// opened. Useful when only "right now" data is available.
const Example = () => {
    useExampleState({ shape: `header-only` });
    return (
        <WeatherExpandable
            data={{
                temperature: 22.1,
                condition: `dry`,
                icon: `partly-cloudy-day`,
                precipitation_60: 0,
                wind_speed_60: 8
            }}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherExpandable.headerOnly,
    Example
};

export default module;
