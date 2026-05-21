import { Skeleton } from "../../../lib/components/ui/skeleton";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex w-full max-w-sm flex-col gap-3 rounded-md border p-4`}>
            <Skeleton className={`h-32 w-full`} />
            <Skeleton className={`h-5 w-2/3`} />
            <Skeleton className={`h-4 w-full`} />
            <Skeleton className={`h-4 w-5/6`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.skeleton.card,
    Example
};

export default module;
