import { Settings } from "lucide-react";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex flex-wrap items-end gap-2`}>
            <Button size={`sm`}>sm</Button>
            <Button>default</Button>
            <Button size={`lg`}>lg</Button>
            <Button size={`icon`} aria-label={`Settings`}>
                <Settings />
            </Button>
            <Button size={`icon-sm`} aria-label={`Settings sm`}>
                <Settings />
            </Button>
            <Button size={`icon-lg`} aria-label={`Settings lg`}>
                <Settings />
            </Button>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.button.sizes,
    Example
};

export default module;
