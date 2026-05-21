import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex flex-wrap items-center gap-2`}>
            <Button>default</Button>
            <Button variant={`secondary`}>secondary</Button>
            <Button variant={`destructive`}>destructive</Button>
            <Button variant={`outline`}>outline</Button>
            <Button variant={`ghost`}>ghost</Button>
            <Button variant={`link`}>link</Button>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.button.variants,
    Example
};

export default module;
