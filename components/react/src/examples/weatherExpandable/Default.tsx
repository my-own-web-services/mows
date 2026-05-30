import WeatherExpandable from "../../../lib/components/map/weatherExpandable/WeatherExpandable";
import type { WeatherExpandableForecastDay } from "../../../lib/components/map/weatherExpandable/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// All values below are fabricated for demonstration only — no real
// weather service is reached.
const FORECAST: WeatherExpandableForecastDay[] = [
    { date: `2026-04-10`, temp_min: 10, temp_max: 22, icon: `clear-day` },
    {
        date: `2026-04-11`,
        temp_min: 8,
        temp_max: 19,
        icon: `partly-cloudy-day`,
        precipitation_probability: 30
    },
    {
        date: `2026-04-12`,
        temp_min: 6,
        temp_max: 14,
        icon: `rain`,
        precipitation_probability: 80
    },
    {
        date: `2026-04-13`,
        temp_min: 5,
        temp_max: 12,
        icon: `rain`,
        precipitation_probability: 60
    },
    { date: `2026-04-14`, temp_min: 7, temp_max: 16, icon: `partly-cloudy-day` },
    { date: `2026-04-15`, temp_min: 9, temp_max: 19, icon: `clear-day` }
];

const Example = () => {
    useExampleState({ defaultOpen: true, forecastDays: FORECAST.length });

    return (
        <WeatherExpandable
            data={{
                temperature: 16.4,
                condition: `dry`,
                icon: `clear-day`,
                precipitation_60: 0,
                wind_speed_60: 12,
                cloud_cover: 30,
                relative_humidity: 60,
                visibility: 25000,
                pressure_msl: 1013
            }}
            forecast={FORECAST}
            attribution={`Demo data`}
            defaultOpen
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherExpandable.default,
    Example
};

export default module;
