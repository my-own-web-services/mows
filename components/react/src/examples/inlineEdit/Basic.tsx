import { useState } from "react";
import InlineEdit from "../../../lib/components/input/inlineEdit/InlineEdit";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [name, setName] = useState(`vm-control-01`);
    useExampleState({ value: name });

    return (
        <div className={`flex items-center gap-3 text-sm`}>
            <span className={`text-muted-foreground`}>Name:</span>
            <InlineEdit value={name} onCommit={setName} ariaLabel={`VM name`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inlineEdit.basic,
    Example
};

export default module;
