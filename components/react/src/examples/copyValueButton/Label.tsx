import CopyValueButton from "../../../lib/components/input/copyValueButton/CopyValueButton";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ value: `mows-example-token-abc123`, hasLabel: true });

    return (
        <CopyValueButton
            value={`mows-example-token-abc123`}
            label={`Copy token`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.copyValueButton.label,
    Example
};

export default module;
