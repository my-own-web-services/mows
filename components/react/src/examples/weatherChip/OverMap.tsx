import Map from "../../../lib/components/map/Map";
import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ standalone: false, overlay: `weatherChip` });

    return (
        <div className={`relative h-[420px] w-full overflow-hidden rounded-md border`}>
            <Map
                projection={`globe`}
                initialView={{ longitude: 10.89, latitude: 48.37, zoom: 9 }}
            />
            <div className={`absolute top-3 right-3 z-10`}>
                <WeatherChip
                    data={{
                        temperature: 16.4,
                        condition: `dry`,
                        icon: `clear-day`,
                        windSpeed: 12,
                        relativeHumidity: 42
                    }}
                    attribution={`Demo data`}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.overMap,
    Example
};

export default module;
