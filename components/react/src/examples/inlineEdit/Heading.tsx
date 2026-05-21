import { useState } from "react";
import InlineEdit from "../../../lib/components/input/inlineEdit/InlineEdit";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [title, setTitle] = useState(`Untitled document`);
    useExampleState({ value: title, as: `h2` });

    return (
        <div className={`flex flex-col gap-2`}>
            <InlineEdit
                value={title}
                onCommit={setTitle}
                as={`h2`}
                ariaLabel={`Document title`}
                className={`text-2xl font-semibold`}
            />
            <p className={`text-sm text-muted-foreground`}>
                Click the title to rename in place.
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inlineEdit.heading,
    Example
};

export default module;
