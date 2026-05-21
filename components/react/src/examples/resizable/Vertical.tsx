import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "../../../lib/components/ui/resizable";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ direction: `vertical` });

    return (
        <ResizablePanelGroup
            direction={`vertical`}
            className={`h-60 w-full max-w-md rounded-md border`}
        >
            <ResizablePanel defaultSize={40}>
                <div className={`flex h-full items-center justify-center text-sm`}>
                    Top
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60}>
                <div className={`flex h-full items-center justify-center text-sm`}>
                    Bottom (drag the grip)
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resizable.vertical,
    Example
};

export default module;
