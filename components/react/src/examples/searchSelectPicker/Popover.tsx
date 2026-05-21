import { useState } from "react";
import SearchSelectPicker from "../../../lib/components/input/searchSelectPicker/SearchSelectPicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Fruit {
    readonly id: string;
    readonly name: string;
}

const FRUITS: Fruit[] = [
    { id: `apple`, name: `Apple` },
    { id: `banana`, name: `Banana` },
    { id: `cherry`, name: `Cherry` }
];

const Example = () => {
    const [v, setV] = useState<Fruit>(FRUITS[0]!);
    useExampleState({ selected: v.id });

    return (
        <SearchSelectPicker<Fruit>
            items={FRUITS}
            selected={v}
            onSelect={setV}
            getId={(f) => f.id}
            matchesSearch={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
            renderItemContent={(f) => <span>{f.name}</span>}
            placeholder={`Search…`}
            emptyText={`No matches`}
            triggerTitle={`Pick a fruit`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.searchSelectPicker.popover,
    Example
};

export default module;
