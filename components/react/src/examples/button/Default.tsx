import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return <Button>Click me</Button>;
};

const module: ExampleModule = {
    strings: (t) => t.examples.button.default,
    Example
};

export default module;
