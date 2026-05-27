import { useContext, useState } from "react";
import ColorCurves from "../../../lib/components/input/colorCurves/ColorCurves";
import {
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesValue
} from "../../../lib/components/input/colorCurves/applyCurves";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const mowsContext = useContext(MowsContext);
    if (!mowsContext) throw new Error(`Missing <MowsProvider>`);
    const t = mowsContext.t.example.examples.colorCurves;

    const [value, setValue] = useState<ColorCurvesValue>(
        DEFAULT_COLOR_CURVES_VALUE
    );

    useExampleState(value);

    return (
        <div className={`max-w-md`}>
            <ColorCurves
                value={value}
                onChange={setValue}
                strings={t.componentStrings}
                size={300}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.colorCurves.standalone,
    Example
};

export default module;
