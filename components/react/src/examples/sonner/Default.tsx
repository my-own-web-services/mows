import { toast } from "sonner";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex flex-wrap items-center gap-2`}>
            <Button onClick={() => toast(`Just a notification.`)}>
                Show toast
            </Button>
            <Button
                variant={`outline`}
                onClick={() => toast.success(`Saved successfully.`)}
            >
                Show success
            </Button>
            <Button
                variant={`destructive`}
                onClick={() => toast.error(`Something went wrong.`)}
            >
                Show error
            </Button>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sonner.default,
    Example
};

export default module;
