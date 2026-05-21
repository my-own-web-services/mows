import { ScrollArea, ScrollBar } from "../../../lib/components/ui/scroll-area";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ orientation: `horizontal` });

    return (
        <ScrollArea className={`w-full max-w-md rounded-md border whitespace-nowrap`}>
            <div className={`flex gap-3 p-4`}>
                {Array.from({ length: 20 }, (_, i) => (
                    <div
                        key={i}
                        className={`flex h-24 w-32 shrink-0 items-center justify-center rounded-md bg-muted text-sm`}
                    >
                        Card {i + 1}
                    </div>
                ))}
            </div>
            <ScrollBar orientation={`horizontal`} />
        </ScrollArea>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.scrollArea.horizontal,
    Example
};

export default module;
