import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ asChild: true });

    return (
        <Button asChild>
            <a href={`#example-anchor`} rel={`noreferrer`}>
                Link rendered as a button
            </a>
        </Button>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.button.asChild,
    Example
};

export default module;
