import { Button } from "../../../lib/components/ui/button";
import { Input } from "../../../lib/components/ui/input";
import { Label } from "../../../lib/components/ui/label";
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
                <Button variant={`outline`}>Edit name</Button>
            </PopoverTrigger>
            <PopoverContent className={`w-80`}>
                <form
                    className={`flex flex-col gap-3`}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div className={`flex flex-col gap-1.5`}>
                        <Label htmlFor={`popover-name`}>Display name</Label>
                        <Input id={`popover-name`} defaultValue={`Ada Lovelace`} />
                    </div>
                    <Button size={`sm`}>Save</Button>
                </form>
            </PopoverContent>
        </Popover>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.popover.form,
    Example
};

export default module;
