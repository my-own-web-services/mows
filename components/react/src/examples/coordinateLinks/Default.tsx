import CoordinateLinks from "../../../lib/components/map/coordinateLinks/CoordinateLinks";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    return (
        <div className={`w-full max-w-md`}>
            <CoordinateLinks latitude={48.137154} longitude={11.576124} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.coordinateLinks.default,
    Example
};

export default module;
