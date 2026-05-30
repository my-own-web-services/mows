import WeatherExpandable from "../../../lib/components/map/weatherExpandable/WeatherExpandable";
import type { WeatherExpandableForecastDay } from "../../../lib/components/map/weatherExpandable/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const FORECAST: WeatherExpandableForecastDay[] = [
    { date: `2026-04-10`, temp_min: 4, temp_max: 9, icon: `cloudy` },
    {
        date: `2026-04-11`,
        temp_min: 3,
        temp_max: 8,
        icon: `rain`,
        precipitation_probability: 70
    },
    { date: `2026-04-12`, temp_min: 1, temp_max: 6, icon: `snow`, precipitation_probability: 50 }
];

const Example = () => {
    useExampleState({ defaultOpen: false });
    return (
        <WeatherExpandable
            data={{
                temperature: 5.2,
                condition: `cloudy`,
                icon: `cloudy`,
                precipitation_60: 0.8,
                wind_speed_60: 18,
                cloud_cover: 85,
                relative_humidity: 78
            }}
            forecast={FORECAST}
            attribution={`Demo data`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherExpandable.collapsed,
    Example
};

export default module;
