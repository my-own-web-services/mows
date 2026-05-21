import { Progress } from "../../../lib/components/ui/progress";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ value: 60 });

    return (
        <div className={`w-full max-w-md`}>
            <Progress value={60} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.progress.default,
    Example
};

export default module;
