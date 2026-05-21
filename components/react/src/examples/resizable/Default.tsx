import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "../../../lib/components/ui/resizable";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ direction: `horizontal`, defaultSizes: [25, 50, 25] });

    return (
        <ResizablePanelGroup
            direction={`horizontal`}
            className={`h-48 w-full max-w-2xl rounded-md border`}
        >
            <ResizablePanel defaultSize={25}>
                <div className={`flex h-full items-center justify-center text-sm`}>
                    Panel 1
                </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
                <div className={`flex h-full items-center justify-center text-sm`}>
                    Panel 2
                </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={25}>
                <div className={`flex h-full items-center justify-center text-sm`}>
                    Panel 3
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resizable.default,
    Example
};

export default module;
