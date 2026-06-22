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
    }
];

const Example = () => {
    useExampleState({ locale: `en-US`, temperatureUnit: `fahrenheit` });
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
            locale={`en-US`}
            // en-US users live with Fahrenheit. The component still
            // receives °C-shaped data (Bright Sky / DWD never report
            // anything else) — `temperatureUnit` flips display only.
            temperatureUnit={`fahrenheit`}
            strings={{
                title: `Weather`,
                conditionDry: `Dry`,
                conditionFog: `Fog`,
                conditionRain: `Rain`,
                conditionSleet: `Sleet`,
                conditionSnow: `Snow`,
                conditionHail: `Hail`,
                conditionThunderstorm: `Thunderstorm`,
                cloudCoverLabel: `Cloud cover`,
                humidityLabel: `Humidity`,
                visibilityLabel: `Visibility`,
                pressureLabel: `Pressure`,
                expandLabel: `Show forecast`,
                collapseLabel: `Hide forecast`
            }}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherExpandable.localised,
    Example
};

export default module;
