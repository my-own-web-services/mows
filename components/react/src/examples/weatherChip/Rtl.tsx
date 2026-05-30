import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ direction: `rtl` });

    return (
        <div dir={`rtl`}>
            <WeatherChip
                data={{
                    temperature: 24.3,
                    condition: `dry`,
                    icon: `clear-day`,
                    windSpeed: 8,
                    relativeHumidity: 35
                }}
                strings={{
                    modeCurrent: `الآن`,
                    conditionDry: `جاف`,
                    title: `الطقس`
                }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.rtl,
    Example
};

export default module;
