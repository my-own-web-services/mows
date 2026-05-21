import { ScrollArea } from "../../../lib/components/ui/scroll-area";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <ScrollArea className={`h-48 w-full max-w-md rounded-md border p-4`}>
            <div className={`flex flex-col gap-2 text-sm`}>
                {Array.from({ length: 30 }, (_, i) => (
                    <div key={i}>Item {i + 1}</div>
                ))}
            </div>
        </ScrollArea>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scrollArea.default,
    Example
};

export default module;
