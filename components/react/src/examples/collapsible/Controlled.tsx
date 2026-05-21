import { useState } from "react";
import { Button } from "../../../lib/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "../../../lib/components/ui/collapsible";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [open, setOpen] = useState(false);
    useExampleState({ open });

    return (
        <div className={`flex w-72 flex-col gap-3`}>
            <div className={`flex items-center gap-2`}>
                <Button size={`sm`} variant={`outline`} onClick={() => setOpen((v) => !v)}>
                    External toggle
                </Button>
                <span className={`text-xs text-muted-foreground`}>open = {String(open)}</span>
            </div>
            <Collapsible open={open} onOpenChange={setOpen} className={`rounded-md border bg-card p-3`}>
                <CollapsibleTrigger className={`text-sm font-medium`}>
                    Click row or button
                </CollapsibleTrigger>
                <CollapsibleContent className={`mt-2 text-sm text-muted-foreground`}>
                    Either control surface flips the same open state.
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.collapsible.controlled,
    Example
};

export default module;
