import WeatherChip from "../../../lib/components/map/weatherChip/WeatherChip";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ locale: `de-DE` });

    return (
        <WeatherChip
            mode={`forecast`}
            at={new Date(`2026-04-10T15:00:00Z`)}
            data={{
                temperature: 22.1,
                condition: `rain`,
                icon: `rain`,
                precipitation: 1.4,
                windSpeed: 12,
                relativeHumidity: 78
            }}
            locale={`de-DE`}
            strings={{
                modeCurrent: `Aktuell`,
                modeForecast: `Vorhersage`,
                modeHistorical: `Verlauf`,
                conditionDry: `Trocken`,
                conditionFog: `Nebel`,
                conditionRain: `Regen`,
                conditionSleet: `Schneeregen`,
                conditionSnow: `Schnee`,
                conditionHail: `Hagel`,
                conditionThunderstorm: `Gewitter`,
                title: `Wetter`,
                loadingLabel: `Wird geladen`
            }}
            attribution={`Beispiel-Daten`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.weatherChip.localised,
    Example
};

export default module;
