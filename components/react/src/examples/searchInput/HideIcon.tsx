import { useState } from "react";
import SearchInput from "../../../lib/components/input/searchInput/SearchInput";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState(``);
    useExampleState({ hideIcon: true, value });

    return (
        <div className={`max-w-md`}>
            <SearchInput
                value={value}
                onValueChange={setValue}
                placeholder={`Search (no icon)`}
                aria-label={`Search`}
                hideIcon
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.searchInput.hideIcon,
    Example
};

export default module;
