import { Skeleton } from "../../../lib/components/ui/skeleton";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex w-full max-w-sm items-center gap-4`}>
            <Skeleton className={`h-12 w-12 rounded-full`} />
            <div className={`flex flex-1 flex-col gap-2`}>
                <Skeleton className={`h-4 w-3/4`} />
                <Skeleton className={`h-4 w-1/2`} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.skeleton.default,
    Example
};

export default module;
