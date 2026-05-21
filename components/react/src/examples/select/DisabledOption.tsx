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
    useExampleState({ disabledOption: `cherry` });

    return (
        <div className={`max-w-xs`}>
            <Select defaultValue={`apple`}>
                <SelectTrigger>
                    <SelectValue placeholder={`Pick a fruit`} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={`apple`}>Apple</SelectItem>
                    <SelectItem value={`banana`}>Banana</SelectItem>
                    <SelectItem value={`cherry`} disabled>
                        Cherry (disabled)
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.select.disabledOption,
    Example
};

export default module;
