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
    { id: `cherry`, name: `Cherry` },
    { id: `date`, name: `Date` },
    { id: `elderberry`, name: `Elderberry` }
];

const Example = () => {
    const [v, setV] = useState<Fruit>(FRUITS[0]!);
    useExampleState({ selected: v.id });

    return (
        <div className={`max-w-xs rounded-md border`}>
            <SearchSelectPicker<Fruit>
                standalone
                items={FRUITS}
                selected={v}
                onSelect={setV}
                getId={(f) => f.id}
                matchesSearch={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
                renderItemContent={(f) => <span>{f.name}</span>}
                placeholder={`Search fruit…`}
                emptyText={`No matches`}
                triggerTitle={`Pick a fruit`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.searchSelectPicker.standalone,
    Example
};

export default module;
