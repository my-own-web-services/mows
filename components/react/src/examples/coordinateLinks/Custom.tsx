import CoordinateLinks from "../../../lib/components/map/coordinateLinks/CoordinateLinks";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    return (
        <div className={`w-full max-w-md`}>
            <CoordinateLinks
                latitude={48.137154}
                longitude={11.576124}
                providers={[
                    `geo`,
                    `openstreetmap`,
                    `google`,
                    {
                        id: `acme`,
                        label: `ACME Geo`,
                        buildUrl: (lat, lng) =>
                            `https://example.com/?p=${lat.toFixed(4)},${lng.toFixed(4)}`
                    }
                ]}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.coordinateLinks.custom,
    Example
};

export default module;
