import { Search } from "lucide-react";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from "../../../lib/components/ui/input-group";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <InputGroup className={`max-w-sm`}>
            <InputGroupAddon>
                <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder={`Search…`} />
        </InputGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inputGroup.default,
    Example
};

export default module;
