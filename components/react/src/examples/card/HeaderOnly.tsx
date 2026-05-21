import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle
} from "../../../lib/components/ui/card";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ hasContent: false, hasFooter: false });

    return (
        <Card className={`w-full max-w-sm`}>
            <CardHeader>
                <CardTitle>Heads-up</CardTitle>
                <CardDescription>
                    Cards work fine with just a header — content / footer are optional.
                </CardDescription>
            </CardHeader>
        </Card>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.card.headerOnly,
    Example
};

export default module;
