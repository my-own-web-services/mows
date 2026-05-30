import { useState } from "react";
import StaggeredCheckboxes, {
    type StaggeredCheckboxNode
} from "../../../lib/components/input/staggeredCheckboxes/StaggeredCheckboxes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const TREE: StaggeredCheckboxNode[] = [
    {
        id: `europe`,
        label: `Europe`,
        children: [
            { id: `de`, label: `Germany`, searchKeywords: [`deutschland`] },
            { id: `fr`, label: `France` },
            { id: `it`, label: `Italy` },
            { id: `es`, label: `Spain` }
        ]
    },
    {
        id: `americas`,
        label: `Americas`,
        children: [
            { id: `us`, label: `United States`, searchKeywords: [`usa`, `america`] },
            { id: `ca`, label: `Canada` },
            { id: `br`, label: `Brazil` },
            { id: `mx`, label: `Mexico` }
        ]
    },
    {
        id: `asia`,
        label: `Asia`,
        children: [
            { id: `jp`, label: `Japan` },
            { id: `kr`, label: `South Korea` },
            { id: `in`, label: `India` },
            { id: `cn`, label: `China` }
        ]
    }
];

const Example = () => {
    const [value, setValue] = useState<ReadonlySet<string>>(new Set());
    useExampleState({ checked: [...value].sort() });

    return (
        <StaggeredCheckboxes
            nodes={TREE}
            value={value}
            onValueChange={setValue}
            searchable
            searchPlaceholder={`Search countries`}
            emptyLabel={`No countries matched`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.staggeredCheckboxes.searchable,
    Example
};

export default module;
