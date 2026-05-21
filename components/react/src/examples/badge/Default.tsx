import { Badge } from "../../../lib/components/ui/badge";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ variant: `default` });

    return <Badge>Default</Badge>;
};

const module: ExampleModule = {
    strings: (t) => t.examples.badge.default,
    Example
};

export default module;
