import { useState } from "react";
import ButtonSelect from "../../../lib/components/input/buttonSelect/ButtonSelect";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [selected, setSelected] = useState(`grid`);
    useExampleState({ selected });

    return (
        <ButtonSelect
            selectedId={selected}
            onSelectionChange={setSelected}
            options={[
                { id: `grid`, icon: `▦`, label: `Grid` },
                { id: `list`, icon: `≣`, label: `List` },
                { id: `table`, icon: `▤`, label: `Table` }
            ]}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.buttonSelect.default,
    Example
};

export default module;
