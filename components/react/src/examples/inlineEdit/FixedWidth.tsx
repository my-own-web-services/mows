import { useState } from "react";
import InlineEdit from "../../../lib/components/input/inlineEdit/InlineEdit";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [name, setName] = useState(`vm-control-01`);
    useExampleState({ value: name, width: 240 });

    return (
        <div className={`flex flex-col gap-3 text-sm`}>
            <p className={`text-muted-foreground`}>
                The editor is pinned to 240px — typing past that scrolls the caret
                horizontally inside the box instead of expanding the row.
            </p>
            <div className={`flex items-center gap-3`}>
                <span className={`text-muted-foreground`}>Name:</span>
                <InlineEdit value={name} onCommit={setName} width={240} ariaLabel={`VM name`} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inlineEdit.fixedWidth,
    Example
};

export default module;
