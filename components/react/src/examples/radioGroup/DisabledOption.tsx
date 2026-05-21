import { Label } from "../../../lib/components/ui/label";
import {
    RadioGroup,
    RadioGroupItem
} from "../../../lib/components/ui/radio-group";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabledOption: `cherry` });

    return (
        <RadioGroup defaultValue={`apple`} className={`flex flex-col gap-2`}>
            <Label className={`flex items-center gap-2`}>
                <RadioGroupItem value={`apple`} /> Apple
            </Label>
            <Label className={`flex items-center gap-2`}>
                <RadioGroupItem value={`banana`} /> Banana
            </Label>
            <Label className={`flex items-center gap-2 opacity-60`}>
                <RadioGroupItem value={`cherry`} disabled /> Cherry (disabled)
            </Label>
        </RadioGroup>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.radioGroup.disabledOption,
    Example
};

export default module;
