import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const HISTORICAL_AT = new Date(`2026-04-08T13:00:00Z`);

const Example = () => {
    useExampleState({ mode: `historical`, at: HISTORICAL_AT.toISOString() });

    return (
        <WeatherChip
            mode={`historical`}
            at={HISTORICAL_AT}
            data={{
                temperature: 8.2,
                condition: `rain`,
                icon: `rain`,
                precipitation: 1.4,
                windSpeed: 18,
                relativeHumidity: 86
            }}
            locale={`en-US`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.historical,
    Example
};

export default module;
