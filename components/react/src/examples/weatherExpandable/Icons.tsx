import WeatherExpandable from "../../../lib/components/map/weatherExpandable/WeatherExpandable";
import type { WeatherExpandableForecastDay } from "../../../lib/components/map/weatherExpandable/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

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
        temp_min: 2,
        temp_max: 9,
        icon: `snow`,
        precipitation_probability: 70
    },
    {
        date: `2026-04-14`,
        temp_min: 11,
        temp_max: 24,
        icon: `thunderstorm`,
        precipitation_probability: 55
    }
];

const Example = () => {
    useExampleState({ glyphStyle: `icon` });
    return (
        <WeatherExpandable
            data={{
                temperature: 16.4,
                condition: `dry`,
                icon: `clear-day`,
                precipitation_60: 0.8,
                wind_speed_60: 12,
                cloud_cover: 30,
                relative_humidity: 60,
                visibility: 25000,
                pressure_msl: 1013
            }}
            forecast={FORECAST}
            attribution={`Demo data`}
            defaultOpen
            // Swap colour emoji for monochrome lucide icons. Useful
            // when the host design system enforces a single stroke
            // style across the UI.
            glyphStyle={`icon`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherExpandable.icons,
    Example
};

export default module;
