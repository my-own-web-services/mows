import CoordinateLinks from "../../../lib/components/map/coordinateLinks/CoordinateLinks";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { useContext } from "react";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const mowsContext = useContext(MowsContext);
    if (!mowsContext) throw new Error(`Missing MowsProvider`);
    const t = mowsContext.t.example.examples.coordinateLinks;
    return (
        <div className={`w-full max-w-md`}>
            <CoordinateLinks
                latitude={48.137154}
                longitude={11.576124}
                label={t.withLabel.label}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.coordinateLinks.withLabel,
    Example
};

export default module;
