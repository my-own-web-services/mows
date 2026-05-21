import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });

    return (
        <div className={`w-full max-w-md opacity-60`}>
            <Slider defaultValue={[40]} disabled />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.slider.disabled,
    Example
};

export default module;
