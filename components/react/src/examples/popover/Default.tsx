import { Button } from "../../../lib/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "../../../lib/components/ui/popover";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={`outline`}>Open popover</Button>
            </PopoverTrigger>
            <PopoverContent className={`w-72`}>
                <p className={`text-sm`}>
                    Popovers are non-modal — clicks outside dismiss them, and Escape
                    closes.
                </p>
            </PopoverContent>
        </Popover>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.popover.default,
    Example
};

export default module;
