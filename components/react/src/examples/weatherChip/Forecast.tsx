import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const FORECAST_AT = new Date(`2026-04-10T15:00:00Z`);

const Example = () => {
    useExampleState({ mode: `forecast`, at: FORECAST_AT.toISOString() });

    return (
        <WeatherChip
            mode={`forecast`}
            at={FORECAST_AT}
            data={{
                temperature: 22.1,
                condition: `dry`,
                icon: `partly-cloudy-day`,
                windSpeed: 8.4,
                precipitation: 0
            }}
            locale={`en-US`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.forecast,
    Example
};

export default module;
