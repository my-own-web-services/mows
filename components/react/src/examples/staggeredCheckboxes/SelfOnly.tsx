import { useState } from "react";
import StaggeredCheckboxes, {
    type StaggeredCheckboxNode
} from "../../../lib/components/input/staggeredCheckboxes/StaggeredCheckboxes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const TREE: StaggeredCheckboxNode[] = [
    {
        id: `read`,
        label: `Read`,
        children: [
            { id: `read.files`, label: `read.files` },
            { id: `read.users`, label: `read.users` }
        ]
    },
    {
        id: `write`,
        label: `Write`,
        children: [
            { id: `write.files`, label: `write.files` },
            { id: `write.users`, label: `write.users` }
        ]
    }
];

const Example = () => {
    const [value, setValue] = useState<ReadonlySet<string>>(new Set([`read`]));
    useExampleState({ checked: [...value].sort() });

    return (
        <StaggeredCheckboxes
            nodes={TREE}
            value={value}
            onValueChange={setValue}
            cascade={`selfOnly`}
            defaultExpanded
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.staggeredCheckboxes.selfOnly,
    Example
};

export default module;
