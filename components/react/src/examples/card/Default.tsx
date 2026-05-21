import { Button } from "../../../lib/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "../../../lib/components/ui/card";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <Card className={`w-full max-w-sm`}>
            <CardHeader>
                <CardTitle>Project</CardTitle>
                <CardDescription>A short supporting line.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={`text-sm`}>
                    Cards group related content and actions. The body sits between header
                    and footer.
                </p>
            </CardContent>
            <CardFooter className={`justify-end gap-2`}>
                <Button variant={`outline`}>Cancel</Button>
                <Button>Confirm</Button>
            </CardFooter>
        </Card>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.card.default,
    Example
};

export default module;
