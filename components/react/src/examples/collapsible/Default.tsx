import { ChevronsUpDown } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "../../../lib/components/ui/collapsible";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const items = [`@radix-ui/react-collapsible`, `@radix-ui/react-popover`, `@radix-ui/react-dialog`];

const Example = () => {
    useExampleState({ pattern: `uncontrolled + defaultOpen` });

    return (
        <Collapsible defaultOpen className={`w-72 rounded-md border bg-card p-3`}>
            <CollapsibleTrigger className={`flex w-full items-center justify-between text-sm font-medium`}>
                <span>@radix-ui packages</span>
                <ChevronsUpDown className={`size-4 opacity-60`} />
            </CollapsibleTrigger>
            <CollapsibleContent className={`mt-2 flex flex-col gap-1 text-sm text-muted-foreground`}>
                {items.map((name) => (
                    <code key={name} className={`rounded bg-muted px-2 py-1 font-mono text-xs`}>
                        {name}
                    </code>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.collapsible.default,
    Example
};

export default module;
