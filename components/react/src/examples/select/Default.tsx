import { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "../../../lib/components/ui/select";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<string>();
    useExampleState({ value });

    return (
        <div className={`flex max-w-xs flex-col gap-2`}>
            <Select value={value} onValueChange={setValue}>
                <SelectTrigger>
                    <SelectValue placeholder={`Pick a fruit`} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={`apple`}>Apple</SelectItem>
                    <SelectItem value={`banana`}>Banana</SelectItem>
                    <SelectItem value={`cherry`}>Cherry</SelectItem>
                </SelectContent>
            </Select>
            <p className={`text-xs text-muted-foreground`}>
                Active value: <code>{value ?? `—`}</code>
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.select.default,
    Example
};

export default module;
