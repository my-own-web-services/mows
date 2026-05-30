import { useState } from "react";
import { Button } from "../../../lib/components/ui/button";
import ExpandableSection from "../../../lib/components/navigation/expandableSection/ExpandableSection";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [open, setOpen] = useState(false);
    useExampleState({ open });

    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <div className={`flex items-center gap-2`}>
                <Button
                    size={`sm`}
                    variant={`outline`}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? `Collapse externally` : `Expand externally`}
                </Button>
                <span className={`text-muted-foreground text-xs`}>
                    open = <code className={`tabular-nums`}>{String(open)}</code>
                </span>
            </div>
            <ExpandableSection
                header={
                    <span className={`text-sm font-medium`}>Notes</span>
                }
                open={open}
                onOpenChange={setOpen}
                expandLabel={`Show notes`}
                collapseLabel={`Hide notes`}
            >
                <p className={`text-muted-foreground px-3 py-2 text-xs`}>
                    The disclosure state is fully controlled by the consumer. Both the
                    chevron click and the external button mutate the same{` `}
                    <code>open</code> state.
                </p>
            </ExpandableSection>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableSection.controlled,
    Example
};

export default module;
