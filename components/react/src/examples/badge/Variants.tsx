import { Badge } from "../../../lib/components/ui/badge";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({
        variants: [
            `default`,
            `secondary`,
            `destructive`,
            `outline`,
            `success`,
            `warning`,
            `info`,
            `muted`
        ]
    });

    return (
        <div className={`flex flex-wrap items-center gap-2`}>
            <Badge>default</Badge>
            <Badge variant={`secondary`}>secondary</Badge>
            <Badge variant={`destructive`}>destructive</Badge>
            <Badge variant={`outline`}>outline</Badge>
            <Badge variant={`success`}>success</Badge>
            <Badge variant={`warning`}>warning</Badge>
            <Badge variant={`info`}>info</Badge>
            <Badge variant={`muted`}>muted</Badge>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.badge.variants,
    Example
};

export default module;
