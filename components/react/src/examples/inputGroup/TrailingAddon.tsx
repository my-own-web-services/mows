import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText
} from "../../../lib/components/ui/input-group";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ align: `inline-end` });

    return (
        <InputGroup className={`max-w-sm`}>
            <InputGroupInput placeholder={`Amount`} type={`number`} />
            <InputGroupAddon align={`inline-end`}>
                <InputGroupText>EUR</InputGroupText>
            </InputGroupAddon>
        </InputGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.inputGroup.trailingAddon,
    Example
};

export default module;
