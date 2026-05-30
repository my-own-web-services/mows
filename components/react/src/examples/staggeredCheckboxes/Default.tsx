import { useState } from "react";
import StaggeredCheckboxes, {
    type StaggeredCheckboxNode
} from "../../../lib/components/input/staggeredCheckboxes/StaggeredCheckboxes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const TREE: StaggeredCheckboxNode[] = [
    {
        id: `frontend`,
        label: `Frontend`,
        children: [
            { id: `dashboard`, label: `Dashboard` },
            { id: `settings`, label: `Settings` },
            {
                id: `marketing`,
                label: `Marketing`,
                children: [
                    { id: `landing`, label: `Landing page` },
                    { id: `blog`, label: `Blog` }
                ]
            }
        ]
    },
    {
        id: `backend`,
        label: `Backend`,
        children: [
            { id: `api`, label: `API` },
            { id: `workers`, label: `Workers` },
            { id: `cron`, label: `Cron jobs` }
        ]
    }
];

const Example = () => {
    const [value, setValue] = useState<ReadonlySet<string>>(
        new Set([`dashboard`, `blog`])
    );
    useExampleState({ checked: [...value].sort() });

    return (
        <StaggeredCheckboxes
            nodes={TREE}
            value={value}
            onValueChange={setValue}
            defaultExpanded
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.staggeredCheckboxes.default,
    Example
};

export default module;
