import { useState } from "react";
import InlineEdit from "../../../lib/components/input/inlineEdit/InlineEdit";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [label, setLabel] = useState(``);
    useExampleState({ value: label });

    return (
        <div className={`flex items-center gap-3 text-sm`}>
            <span className={`text-muted-foreground`}>Label:</span>
            <InlineEdit
                value={label}
                onCommit={setLabel}
                placeholder={`Add a label…`}
                ariaLabel={`Resource label`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inlineEdit.placeholder,
    Example
};

export default module;
