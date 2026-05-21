import { useState } from "react";
import OptionPicker, {
    type OptionItem
} from "../../../lib/components/input/optionPicker/OptionPicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [opts, setOpts] = useState<OptionItem[]>([
        { id: `compact`, label: `Compact rows`, enabled: true },
        { id: `wrap`, label: `Wrap text`, enabled: false },
        { id: `lineNumbers`, label: `Line numbers`, enabled: true }
    ]);
    useExampleState({ enabled: opts.filter((o) => o.enabled).map((o) => o.id) });

    return (
        <OptionPicker
            options={opts}
            onOptionChange={(id, enabled) =>
                setOpts((prev) => prev.map((o) => (o.id === id ? { ...o, enabled } : o)))
            }
            showCount
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.optionPicker.default,
    Example
};

export default module;
