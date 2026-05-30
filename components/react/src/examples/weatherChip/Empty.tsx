import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ data: null });

    return <WeatherChip data={null} attribution={`Demo data`} />;
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.empty,
    Example
};

export default module;
